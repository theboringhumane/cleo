import { TaskOptions } from '../types/interfaces';
import { TaskState } from '../types/enums';
import { logger } from '../utils/logger';
import { cleo } from '../index';

export interface TaskConfig extends TaskOptions {
  name?: string;
}

export function task(config: TaskConfig = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const taskName = config.name || propertyKey;

    descriptor.value = async function (...args: any[]) {
      logger.info('File: task.ts 🎯, Line: 20, Function: task decorator;', {
        taskName,
        args
      });

      const taskOptions: TaskOptions = {
        id: config.id,
        priority: config.priority,
        maxRetries: config.maxRetries,
        retryDelay: config.retryDelay,
        timeout: config.timeout,
        schedule: config.schedule,
        queue: config.queue
      };

      try {
        // Get queue manager through the public method
        const queueManager = cleo.getQueueManager();
        const task = await queueManager.addTask(taskName, args[0], taskOptions);

        logger.info('File: task.ts ✅, Line: 40, Function: task decorator;', {
          taskId: task.id,
          taskName,
          state: TaskState.PENDING
        });

        return task;
      } catch (error) {
        logger.error('File: task.ts ❌, Line: 48, Function: task decorator;', {
          taskName,
          error
        });
        throw error;
      }
    };

    return descriptor;
  };
}
