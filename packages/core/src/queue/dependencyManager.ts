import { Queue, Job } from 'bullmq';
import { Task } from '../types/interfaces';
import { logger } from '../utils/logger';
import { redisConnection } from '../config/redis';

export class DependencyManager {
  private dependencyQueue: Queue;

  constructor() {
    this.dependencyQueue = new Queue('dependency-manager', {
      connection: redisConnection,
    });
  }

  async addTaskWithDependencies(
    task: Task,
    dependencies: string[],
    timeout: number = 30000
  ): Promise<Job> {
    logger.info('File: dependencyManager.ts', '🔗', '18', 'addTaskWithDependencies', 'taskId', 
      `Adding task with dependencies: ${task.id}`);

    // Create a wrapper job that checks dependencies
    const job = await this.dependencyQueue.add('check-dependencies', {
      task,
      dependencies,
      startTime: Date.now(),
      timeout,
    }, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });

    return job;
  }

  async checkDependencies(dependencies: string[]): Promise<boolean> {
    try {
      const results = await Promise.all(
        dependencies.map(async (depId) => {
          const job = await this.dependencyQueue.getJob(depId);
          return job?.finishedOn != null;
        })
      );

      return results.every(Boolean);
    } catch (error) {
      logger.error('File: dependencyManager.ts', '❌', '48', 'checkDependencies', 'error',
        `Failed to check dependencies: ${error}`);
      throw error;
    }
  }

  async getDependencyStatus(taskId: string): Promise<{
    completed: string[];
    pending: string[];
    failed: string[];
  }> {
    const job = await this.dependencyQueue.getJob(taskId);
    if (!job) {
      return { completed: [], pending: [], failed: [] };
    }

    const { dependencies } = job.data;
    const status = {
      completed: [] as string[],
      pending: [] as string[],
      failed: [] as string[],
    };

    await Promise.all(
      dependencies.map(async (depId: string) => {
        const depJob = await this.dependencyQueue.getJob(depId);
        if (!depJob) {
          status.failed.push(depId);
        } else if (depJob.finishedOn) {
          status.completed.push(depId);
        } else {
          status.pending.push(depId);
        }
      })
    );

    return status;
  }

  async close(): Promise<void> {
    await this.dependencyQueue.close();
  }
} 