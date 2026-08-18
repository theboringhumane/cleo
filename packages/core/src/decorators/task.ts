import { TaskOptions } from "../types/interfaces";
import { logger } from "../utils/logger";
import { ObserverEvent, TaskState, TaskStatus } from "../types/enums";
import { redisConnection } from "../config/redis";
import { generateUUID } from "../utils";

// Define interface for both client and worker modes
interface CleoInstance {
  getQueueManager(): any;
  isClientModeEnabled?(): boolean;
}

let cleoInstance: CleoInstance | null = null;

export function initializeTaskDecorator(instance: CleoInstance) {
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
    
    // Check if we're in client mode (no workers)
    const isClientMode = cleoInstance.isClientModeEnabled ? cleoInstance.isClientModeEnabled() : false;

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
      }, !isClientMode); // Only create workers if not in client mode
    }

    // Only register task handlers in worker mode
    if (!isClientMode) {
      // Get or initialize worker (only in worker mode)
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
    }

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

        // Handle group tasks differently from regular tasks
        if (taskOptions.group) {
          // For group tasks, use QueueManager's addTaskToGroup method
          await queueManager.addTaskToGroup(methodName, taskOptions, {
            args,
            context: this,
          });

          // In client mode, group tasks are processed on different machines
          // so we don't wait for completion events - just return immediately
          if (queueManager.isClientMode()) {
            logger.info("🎯 Task Decorator: Group task submitted (client mode)", {
              file: "task.ts",
              function: methodName,
              taskId,
              group: taskOptions.group,
            });
            return Promise.resolve(undefined);
          }

          return new Promise((resolve, reject) => {
            const onCompleted = (
              completedTaskId: string,
              status: TaskStatus,
              data: any
            ) => {
              if (!isSettled && completedTaskId === taskId) {
                isSettled = true;
                cleanup();
                resolve(data?.result);
              }
            };

            const onFailed = (
              failedTaskId: string,
              status: TaskStatus,
              data: any
            ) => {
              if (!isSettled && failedTaskId === taskId) {
                isSettled = true;
                cleanup();
                reject(data?.error || new Error("Task failed"));
              }
            };

            timeoutId = setTimeout(() => {
              if (!isSettled) {
                isSettled = true;
                cleanup();
                reject(new Error("Task processing timeout"));
              }
            }, taskOptions.timeout);

            const cleanup = () => {
              queueManager.offTaskEvent(ObserverEvent.TASK_COMPLETED, onCompleted);
              queueManager.offTaskEvent(ObserverEvent.TASK_FAILED, onFailed);
              clearTimeout(timeoutId);
            };

            queueManager.onTaskEvent(ObserverEvent.TASK_COMPLETED, onCompleted);
            queueManager.onTaskEvent(ObserverEvent.TASK_FAILED, onFailed);

            // Handle cancellation through TaskGroup
            if (
              typeof AbortSignal !== "undefined" &&
              args[0] instanceof AbortSignal
            ) {
              const signal = args[0] as AbortSignal;

              if (signal.aborted) {
                if (!isSettled) {
                  isSettled = true;
                  cleanup();
                  queueManager.getGroup(taskOptions.group).stopProcessing().catch(logger.error);
                  reject(new Error("Task was cancelled"));
                }
                return;
              }

              signal.addEventListener(
                "abort",
                async () => {
                  if (!isSettled) {
                    isSettled = true;
                    cleanup();
                    await queueManager.getGroup(taskOptions.group).stopProcessing();
                    reject(new Error("Task was cancelled"));
                  }
                },
                { once: true }
              );
            }
          });
        } else {
          // For regular (non-group) tasks, add directly to queue
          const task = await queueManager.addTask(
            methodName,
            {
              args,
              context: this,
            },
            taskOptions
          );
          return task.result;
        }
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
