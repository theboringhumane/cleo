import { Queue, JobsOptions } from 'bullmq';
import { Task, TaskOptions } from '../types/interfaces';
import { TaskState } from '../types/enums';
import { logger } from '../utils/logger';
import { redisConnection } from '../config/redis';

export class QueueManager {
  private queues: Map<string, Queue>;

  constructor(defaultQueueName: string) {
    logger.info('File: queueManager.ts 🎯, Line: 9, Function: constructor;', {
      defaultQueueName
    });

    this.queues = new Map();
    this.queues.set(defaultQueueName, new Queue(defaultQueueName, {
      connection: redisConnection
    }));
  }

  async addTask(name: string, data: any, options: TaskOptions = {}): Promise<Task> {
    const queueName = options.queue || 'default';
    let queue = this.queues.get(queueName);

    if (!queue) {
      logger.info('File: queueManager.ts 🆕, Line: 23, Function: addTask;', {
        queueName,
        message: 'Creating new queue'
      });
      queue = new Queue(queueName, {
        connection: redisConnection
      });
      this.queues.set(queueName, queue);
    }

    const task: Task = {
      id: options.id || `${name}-${Date.now()}`,
      name,
      data,
      options,
      state: TaskState.PENDING,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    logger.info('File: queueManager.ts ➕, Line: 42, Function: addTask;', {
      taskId: task.id,
      taskName: task.name,
      queueName
    });

    const jobOptions: JobsOptions = {
      priority: options.priority,
      attempts: options.maxRetries,
      backoff: {
        type: 'exponential',
        delay: options.retryDelay || 1000
      },
      removeOnComplete: options.timeout ? {
        age: options.timeout,
        count: 1000
      } : undefined,
      repeat: options.schedule ? { pattern: options.schedule } : undefined
    };

    await queue.add(name, task, jobOptions);

    return task;
  }

  async getTask(taskId: string, queueName: string = 'default'): Promise<Task | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      logger.error('File: queueManager.ts ❌, Line: 65, Function: getTask;', {
        queueName,
        message: 'Queue not found'
      });
      return null;
    }

    const job = await queue.getJob(taskId);
    if (!job) {
      logger.warn('File: queueManager.ts ⚠️, Line: 73, Function: getTask;', {
        taskId,
        queueName,
        message: 'Task not found'
      });
      return null;
    }

    return job.data as Task;
  }

  async removeTask(taskId: string, queueName: string = 'default'): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      logger.error('File: queueManager.ts ❌, Line: 87, Function: removeTask;', {
        queueName,
        message: 'Queue not found'
      });
      return false;
    }

    const job = await queue.getJob(taskId);
    if (!job) {
      logger.warn('File: queueManager.ts ⚠️, Line: 95, Function: removeTask;', {
        taskId,
        queueName,
        message: 'Task not found'
      });
      return false;
    }

    await job.remove();
    logger.info('File: queueManager.ts 🗑️, Line: 103, Function: removeTask;', {
      taskId,
      queueName,
      message: 'Task removed'
    });

    return true;
  }

  async close(): Promise<void> {
    logger.info('File: queueManager.ts 🔒, Line: 112, Function: close;', {
      message: 'Closing all queues'
    });

    const closePromises = Array.from(this.queues.values()).map(queue => queue.close());
    await Promise.all(closePromises);
    this.queues.clear();
  }
}
