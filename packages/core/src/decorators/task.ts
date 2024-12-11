import { TaskOptions } from "../types/interfaces";
import { logger } from "../utils/logger";
import { ObserverEvent, TaskState } from "../types/enums";
import { redisConnection, type Cleo } from "../index";
import { generateUUID } from "../utils";

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

    let queue = queueManager.getQueue(queueName);

    if (!queue) {
      logger.warn("🔥 Task Decorator: No queue found for", {
        file: "task.ts",
        line: 26,
        function: methodName,
        queueName,
      });

      queueManager.initializeQueue(queueName, {
        connection: redisConnection.getInstance("default"),
      });
    }

    // Register the task at decoration time
    const worker = queueManager.getWorker(queueName);
    if (!worker) {
      throw new Error(`No worker found for queue ${queueName}`);
    }

    // Ensure the method is bound to its instance with proper typing
    worker.registerTask(
      methodName,
      function (this: typeof target, ...args: any[]) {
        logger.debug("🎯 Task Decorator: Executing task", {
          file: "task.ts",
          line: 75,
          function: methodName,
          args,
        });
        return originalMethod.apply(this, args);
      }
    );

    logger.info("🎯 Task Decorator: Task registered", {
      file: "task.ts",
      line: 46,
      function: methodName,
      taskState: TaskState.WAITING,
      group: options.group,
    });

    // Replace the original method with proper typing
    descriptor.value = async function (
      this: typeof target,
      ...args: any[]
    ): Promise<any> {
      const startTime = Date.now();
      let taskId: string | undefined;

      try {
        const taskOptions = {
          ...options,
          id: `${methodName}-${generateUUID()}`,
          timeout: options.timeout || 30000,
          maxRetries: options.maxRetries || 3,
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
          await queueManager.addTaskToGroup(methodName, taskOptions, args);

          // Use event-based approach instead of polling
          return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              queueManager.offTaskEvent(ObserverEvent.TASK_COMPLETED);
              queueManager.offTaskEvent(ObserverEvent.TASK_FAILED);
              reject(new Error("Task processing timeout"));
            }, taskOptions.timeout);

            queueManager.onTaskEvent(
              ObserverEvent.TASK_COMPLETED,
              (completedTaskId, status, result) => {
                if (completedTaskId === taskId) {
                  clearTimeout(timeoutId);
                  queueManager.offTaskEvent(ObserverEvent.TASK_COMPLETED);
                  queueManager.offTaskEvent(ObserverEvent.TASK_FAILED);
                  resolve(result);
                }
              }
            );

            queueManager.onTaskEvent(
              ObserverEvent.TASK_FAILED,
              (failedTaskId, status, error) => {
                if (failedTaskId === taskId) {
                  clearTimeout(timeoutId);
                  queueManager.offTaskEvent(ObserverEvent.TASK_COMPLETED);
                  queueManager.offTaskEvent(ObserverEvent.TASK_FAILED);
                  reject(error);
                }
              }
            );
          });
        }

        // For non-grouped tasks
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
        throw error;
      }
    };

    // Ensure the method is bound to its instance and properly typed
    return Object.assign(descriptor, {
      configurable: true,
      enumerable: true,
      writable: true,
    });
  };
}
