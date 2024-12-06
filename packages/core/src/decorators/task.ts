import { TaskOptions } from "../types/interfaces";
import { TaskState } from "../types/enums";
import { logger } from "../utils/logger";
import { cleo } from "../index";

export interface TaskConfig extends TaskOptions {
  name?: string;
}

export function task(config: TaskConfig = {}): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): void {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      logger.info('File: task.ts 🎯, Function: task decorator;', {
        taskName: config.name || String(propertyKey),
        args,
      });

      const taskOptions: TaskOptions = {
        id: config.id,
        priority: config.priority,
        maxRetries: config.maxRetries,
        retryDelay: config.retryDelay,
        timeout: config.timeout,
        schedule: config.schedule,
        queue: config.queue,
      };

      try {
        const queueManager = cleo.getQueueManager();
        const task = await queueManager.addTask(config.name || String(propertyKey), args[0], taskOptions);

        logger.info('File: task.ts ✅, Function: task decorator;', {
          taskId: task.id,
          taskName: config.name || String(propertyKey),
          state: TaskState.PENDING,
        });

        // Call the original method, passing along any arguments
        const result = await originalMethod.apply(this, args);

        return result;
      } catch (error) {
        logger.error('File: task.ts ❌, Function: task decorator;', {
          taskName: config.name || String(propertyKey),
          error,
        });
        throw error;
      }
    };
  };
}
