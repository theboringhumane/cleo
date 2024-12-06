import { Task } from '../types/interfaces';
import { logger } from '../utils/logger';

export class TaskRegistry {
  private tasks: Map<string, Function>;

  constructor() {
    this.tasks = new Map();
    logger.info('File: taskRegistry.ts 📝, Line: 8, Function: constructor;', {
      message: 'Task registry initialized'
    });
  }

  registerTask(name: string, handler: Function): void {
    logger.info('File: taskRegistry.ts ➕, Line: 15, Function: registerTask;', {
      taskName: name
    });
    this.tasks.set(name, handler);
  }

  getTaskHandler(name: string): Function | undefined {
    const handler = this.tasks.get(name);
    if (!handler) {
      logger.warn('File: taskRegistry.ts ⚠️, Line: 24, Function: getTaskHandler;', {
        taskName: name,
        message: 'Task handler not found'
      });
    }
    return handler;
  }

  async execute(task: Task): Promise<any> {
    const handler = this.getTaskHandler(task.name);
    if (!handler) {
      const error = `No handler registered for task: ${task.name}`;
      logger.error('File: taskRegistry.ts ❌, Line: 35, Function: execute;', {
        taskName: task.name,
        error
      });
      throw new Error(error);
    }

    try {
      logger.info('File: taskRegistry.ts 🔄, Line: 43, Function: execute;', {
        taskName: task.name,
        taskId: task.id
      });

      const result = await handler(task.data);

      logger.info('File: taskRegistry.ts ✅, Line: 50, Function: execute;', {
        taskName: task.name,
        taskId: task.id,
        result
      });

      return result;
    } catch (error) {
      logger.error('File: taskRegistry.ts ❌, Line: 58, Function: execute;', {
        taskName: task.name,
        taskId: task.id,
        error
      });
      throw error;
    }
  }
} 