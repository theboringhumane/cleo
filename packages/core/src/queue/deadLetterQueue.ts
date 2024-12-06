import { Queue, Job } from 'bullmq';
import { Task } from '../types/interfaces';
import { logger } from '../utils/logger';
import { redisConnection } from '../config/redis';
import { EventEmitter } from 'events';

interface DeadLetterConfig {
  maxRetries: number;
  backoff: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
  alertThreshold: number;
}

export class DeadLetterQueue extends EventEmitter {
  private dlq: Queue;
  private config: DeadLetterConfig;
  private alertCount: number = 0;

  constructor(config: DeadLetterConfig) {
    super();
    this.config = config;
    this.dlq = new Queue('dead-letter-queue', {
      connection: redisConnection,
    });

    logger.info('File: deadLetterQueue.ts', '💀', '22', 'constructor', 'config',
      'Dead Letter Queue initialized');
  }

  async addFailedTask(
    task: Task,
    error: Error,
    originalQueue: string
  ): Promise<Job | null> {
    try {
      const dlqEntry = {
        task,
        error: {
          message: error.message,
          stack: error.stack,
        },
        originalQueue,
        failedAt: new Date(),
        retryCount: task.retryCount,
      };

      const job = await this.dlq.add('failed-task', dlqEntry, {
        attempts: 1, // No retries in DLQ
        removeOnComplete: false,
      });

      this.alertCount++;
      if (this.alertCount >= this.config.alertThreshold) {
        this.emit('alert', {
          count: this.alertCount,
          threshold: this.config.alertThreshold,
        });
      }

      logger.warn('File: deadLetterQueue.ts', '⚠️', '51', 'addFailedTask', 'taskId',
        `Task moved to DLQ: ${task.id}`);

      return job;
    } catch (error) {
      logger.error('File: deadLetterQueue.ts', '❌', '56', 'addFailedTask', 'error',
        `Failed to add task to DLQ: ${error}`);
      return null;
    }
  }

  async retryTask(jobId: string): Promise<boolean> {
    try {
      const job = await this.dlq.getJob(jobId);
      if (!job) {
        return false;
      }

      const { task, originalQueue } = job.data;
      const originalQueueInstance = new Queue(originalQueue, {
        connection: redisConnection,
      });

      // Add back to original queue with retry configuration
      await originalQueueInstance.add(task.name, task, {
        attempts: this.config.maxRetries,
        backoff: this.config.backoff,
      });

      // Remove from DLQ
      await job.remove();
      this.alertCount = Math.max(0, this.alertCount - 1);

      logger.info('File: deadLetterQueue.ts', '🔄', '84', 'retryTask', 'jobId',
        `Task retried from DLQ: ${jobId}`);

      return true;
    } catch (error) {
      logger.error('File: deadLetterQueue.ts', '❌', '89', 'retryTask', 'error',
        `Failed to retry task from DLQ: ${error}`);
      return false;
    }
  }

  async getFailedTasks(limit: number = 100, offset: number = 0): Promise<Job[]> {
    try {
      const jobs = await this.dlq.getJobs(['failed'], offset, offset + limit - 1);
      return jobs;
    } catch (error) {
      logger.error('File: deadLetterQueue.ts', '❌', '99', 'getFailedTasks', 'error',
        `Failed to get tasks from DLQ: ${error}`);
      return [];
    }
  }

  async purgeOldEntries(maxAge: number): Promise<number> {
    try {
      const jobs = await this.dlq.getJobs(['failed']);
      let purgedCount = 0;

      for (const job of jobs) {
        const failedAt = new Date(job.data.failedAt).getTime();
        if (Date.now() - failedAt > maxAge) {
          await job.remove();
          purgedCount++;
        }
      }

      logger.info('File: deadLetterQueue.ts', '🧹', '116', 'purgeOldEntries', 'count',
        `Purged ${purgedCount} old entries from DLQ`);

      return purgedCount;
    } catch (error) {
      logger.error('File: deadLetterQueue.ts', '❌', '121', 'purgeOldEntries', 'error',
        `Failed to purge old entries from DLQ: ${error}`);
      return 0;
    }
  }

  async getStats(): Promise<{
    totalFailed: number;
    recentFailures: number;
    oldestEntry: Date | null;
  }> {
    try {
      const jobs = await this.dlq.getJobs(['failed']);
      const now = Date.now();
      const recentThreshold = now - 24 * 60 * 60 * 1000; // 24 hours

      const recentFailures = jobs.filter(
        job => new Date(job.data.failedAt).getTime() > recentThreshold
      ).length;

      const oldestEntry = jobs.length > 0
        ? new Date(Math.min(...jobs.map(job => new Date(job.data.failedAt).getTime())))
        : null;

      return {
        totalFailed: jobs.length,
        recentFailures,
        oldestEntry,
      };
    } catch (error) {
      logger.error('File: deadLetterQueue.ts', '❌', '149', 'getStats', 'error',
        `Failed to get DLQ stats: ${error}`);
      return {
        totalFailed: 0,
        recentFailures: 0,
        oldestEntry: null,
      };
    }
  }

  async close(): Promise<void> {
    await this.dlq.close();
  }
} 