import { TaskOptions } from "../types/interfaces";
import { logger } from "../utils/logger";
import { ObserverEvent, TaskState, TaskStatus } from "../types/enums";
import { redisConnection, type Cleo } from "../index";
import { generateUUID } from "../utils";
import { WorkerType } from "../queue/queueManager";
import { retryWithBackoff } from "../utils/retryWithBackoff";

let cleoInstance: Cleo | null = null;

export function initializeTaskDecorator(instance: Cleo) {
  cleoInstance = instance;
}

export function task(options: TaskOptions = {}): MethodDecorator {
  return function (
    target: Object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const methodName = String(propertyKey);

    if (!cleoInstance) {
      throw new Error("Task decorator used before Cleo initialization");
    }

    const queueName = options.queue || "default";
    const queueManager = cleoInstance.getQueueManager();

    // Get or create queue
    let queue = queueManager.getQueue(queueName);
    if (!queue) {
      logger.warn("🔥 Task Decorator: Creating new queue", {
        file: "task.ts",
        function: methodName,
        queueName,
      });

      queue = queueManager.createQueue(queueName, {
        connection: redisConnection.getInstance("default"),
      });
    }

    // Get or initialize worker
    const worker = queueManager.getWorker(queueName);
    if (!worker) {
      throw new Error(`No worker found for queue ${queueName}`);
    }

    // Register task handler
    worker.registerTask(
      methodName,
      async function (this: typeof target, ...args: any[]) {
        logger.debug("🎯 Task Decorator: Executing task", {
          file: "task.ts",
          function: methodName,
          args,
        });
        return originalMethod.apply(this, args);
      }
    );

    logger.info("🎯 Task Decorator: Task registered", {
      file: "task.ts",
      function: methodName,
      taskState: TaskState.WAITING,
      group: options.group,
    });

    // Replace original method
    descriptor.value = async function (
      this: typeof target,
      ...args: any[]
    ): Promise<any> {
      const startTime = Date.now();
      let taskId: string | undefined;
      let timeoutId: NodeJS.Timeout | undefined;
      let isSettled = false;

      try {
        const taskOptions = {
          ...options,
          id: `${methodName}-${generateUUID()}`,
          timeout: options.timeout || 30000,
          maxRetries: options.maxRetries || 3,
          retryDelay: options.retryDelay || 3000,
        };

        taskId = taskOptions.id;

        const task = await queueManager.addTask(
          methodName,
          {
            args,
            context: this,
          },
          taskOptions
        );

        if (taskOptions.group) {
          const group = await queueManager.getGroup(taskOptions.group);
          await group.addTask(methodName, taskOptions, {
            args,
            context: this,
          });

          return new Promise((resolve, reject) => {
            timeoutId = setTimeout(() => {
              if (!isSettled) {
                isSettled = true;
                cleanup();
                reject(new Error("Task processing timeout"));
              }
            }, taskOptions.timeout);

            const cleanup = () => {
              if (taskId) {
                queueManager.offTaskEvent(ObserverEvent.TASK_COMPLETED);
                queueManager.offTaskEvent(ObserverEvent.TASK_FAILED);
              }
              clearTimeout(timeoutId);
            };

            // Let TaskGroup handle the completion
            queueManager.onTaskEvent(
              ObserverEvent.TASK_COMPLETED,
              (completedTaskId: string, status: TaskStatus, data: any) => {
                if (!isSettled && completedTaskId === taskId) {
                  isSettled = true;
                  cleanup();
                  resolve(data?.result);
                }
              }
            );

            // Let TaskGroup handle the failure
            queueManager.onTaskEvent(
              ObserverEvent.TASK_FAILED,
              (failedTaskId: string, status: TaskStatus, data: any) => {
                if (!isSettled && failedTaskId === taskId) {
                  isSettled = true;
                  cleanup();
                  reject(data?.error || new Error("Task failed"));
                }
              }
            );

            // Handle cancellation through TaskGroup
            if (
              typeof AbortSignal !== "undefined" &&
              args[0] instanceof AbortSignal
            ) {
              const signal = args[0] as AbortSignal;

              if (signal.aborted) {
                cleanup();
                group.stopProcessing().catch(logger.error);
                reject(new Error("Task was cancelled"));
                return;
              }

              signal.addEventListener(
                "abort",
                async () => {
                  if (!isSettled) {
                    isSettled = true;
                    cleanup();
                    await group.stopProcessing();
                    reject(new Error("Task was cancelled"));
                  }
                },
                { once: true }
              );
            }
          });
        }

        return task.result;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        logger.error("❌ Task Decorator: Task execution failed", {
          file: "task.ts",
          function: methodName,
          taskId,
          error,
          executionTime,
          group: options.group,
        });

        if (taskId) {
          queueManager.offTaskEvent(ObserverEvent.TASK_COMPLETED);
          queueManager.offTaskEvent(ObserverEvent.TASK_FAILED);
        }
        clearTimeout(timeoutId);
        throw error;
      }
    };

    Object.defineProperty(descriptor.value, "name", {
      value: methodName,
      configurable: true,
    });

    return Object.assign(descriptor, {
      configurable: true,
      enumerable: true,
      writable: true,
    });
  };
}
