import { TaskOptions } from "../types/interfaces";
import { logger } from "../utils/logger";
import { TaskState } from "../types/enums";
import { redisConnection, type Cleo } from "../index";

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
      throw new Error('Task decorator used before Cleo initialization');
    }
    
    const queueName = options.queue || 'default';
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
        connection: redisConnection.getInstance('default'),
      });
    }

    // Register the task at decoration time
    const worker = queueManager.getWorker(queueName);
    if (!worker) {
      throw new Error(`No worker found for queue ${queueName}`);
    }

    // Ensure the method is bound to its instance with proper typing
    worker.registerTask(methodName, function(this: typeof target, ...args: any[]) {
      logger.debug("🎯 Task Decorator: Executing task", {
        file: "task.ts",
        line: 75,
        function: methodName,
        args,
      });
      return originalMethod.apply(this, args);
    });

    logger.info("🎯 Task Decorator: Task registered", {
      file: "task.ts",
      line: 46,
      function: methodName,
      taskState: TaskState.WAITING,
      group: options.group,
    });

    // Replace the original method with proper typing
    descriptor.value = async function(this: typeof target, ...args: any[]): Promise<any> {
      const startTime = Date.now();
      let taskId: string | undefined;

      try {
        const taskOptions = {
          ...options,
          id: `${methodName}-${Date.now()}`,
          timeout: options.timeout || 30000, // Default 30s timeout
          maxRetries: options.maxRetries || 3, // Default 3 retries
        };

        taskId = taskOptions.id;

        logger.debug("🚀 Task Decorator: Creating task", {
          file: "task.ts",
          line: 100,
          function: methodName,
          taskId,
          options: taskOptions,
        });

        // Create task and add to queue
        const task = await queueManager.addTask(methodName, {
          args,
          context: this,
        }, taskOptions);

        // If task belongs to a group, add it to the group
        if (taskOptions.group) {
          await queueManager.addTaskToGroup(task.id, taskOptions.group);
          
          logger.debug("👥 Task Decorator: Task added to group", {
            file: "task.ts",
            line: 85,
            function: methodName,
            taskId: task.id,
            group: taskOptions.group,
          });

          // Wait for task to be processed with proper error handling
          return new Promise((resolve, reject) => {
            let timeoutId: NodeJS.Timeout;
            let intervalId: NodeJS.Timeout;
            let retryCount = 0;

            const cleanup = () => {
              clearInterval(intervalId);
              clearTimeout(timeoutId);
            };

            const handleError = async (error: Error) => {
              cleanup();
              if (retryCount < taskOptions.maxRetries!) {
                retryCount++;
                logger.warn("⚠️ Task Decorator: Retrying task", {
                  file: "task.ts",
                  line: 150,
                  function: methodName,
                  taskId,
                  error,
                  retry: retryCount,
                });
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                startPolling();
              } else {
                reject(error);
              }
            };

            const startPolling = () => {
              intervalId = setInterval(async () => {
                try {
                  const updatedTask = await queueManager.getTask(task.id);
                  if (!updatedTask) {
                    await handleError(new Error('Task not found'));
                    return;
                  }

                  if (updatedTask.state === TaskState.FAILED) {
                    await handleError(new Error(updatedTask.error || 'Task failed'));
                    return;
                  }

                  if (updatedTask.state !== TaskState.WAITING) {
                    cleanup();
                    const executionTime = Date.now() - startTime;
                    logger.info("✅ Task Decorator: Task completed", {
                      file: "task.ts",
                      line: 180,
                      function: methodName,
                      taskId,
                      executionTime,
                      result: updatedTask.result,
                    });
                    resolve(updatedTask.result);
                  }
                } catch (error) {
                  await handleError(error instanceof Error ? error : new Error(String(error)));
                }
              }, 1000); // Check every second

              // Set a timeout to prevent infinite waiting
              timeoutId = setTimeout(async () => {
                await handleError(new Error('Task processing timeout'));
              }, taskOptions.timeout);
            };

            startPolling();
          });
        }

        // For non-grouped tasks
        logger.info("✅ Task Decorator: Non-grouped task completed", {
          file: "task.ts",
          line: 210,
          function: methodName,
          taskId,
          executionTime: Date.now() - startTime,
          result: task.result,
        });
        return task.result;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        logger.error("❌ Task Decorator: Task execution failed", {
          file: "task.ts",
          line: 220,
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
      writable: true
    });
  };
}
