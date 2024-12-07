import { Job, JobsOptions, Queue } from "bullmq";
import { QueueConfig, Task, TaskOptions } from "../types/interfaces";
import { logger } from "../utils/logger";
import { redisConnection, RedisInstance } from "../config/redis";
import { LogLevel, TaskState } from "../types/enums";
import { log } from "../utils/logger";
import { Worker } from "../workers";

export class PriorityQueueManager {
  private queues: Map<string, Queue>;
  private workers: Map<string, Worker>;
  private rateLimiters: Map<string, { lastRun: number; count: number }>;
  private queueConfigs: Map<string, QueueConfig>;

  constructor(configs: QueueConfig[]) {
    logger.info(
      "File: priorityQueueManager.ts",
      "🎯",
      "15",
      "constructor",
      "configs",
      "Initializing Priority Queue Manager"
    );

    this.queues = new Map();
    this.workers = new Map();
    this.rateLimiters = new Map();
    this.queueConfigs = new Map();

    // Initialize queues in priority order
    configs
      .sort((a, b) => b.priority - a.priority)
      .forEach((config) => this.initializeQueue(config));
  }

  private initializeQueue(config: QueueConfig): void {
    logger.info(
      "File: priorityQueueManager.ts",
      "⚙️",
      "27",
      "initializeQueue",
      "config",
      `Initializing queue: ${config.name}`
    );

    const queue = new Queue(config.name, {
      connection: redisConnection.getInstance(RedisInstance.DEFAULT),
      prefix: config.redis?.prefix,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
      },
    });

    const worker = new Worker(
      config.name,
      {
        concurrency: config.concurrency || 1,
      }
    );
    this.queues.set(config.name, queue);
    this.workers.set(config.name, worker);
    this.queueConfigs.set(config.name, config);

    if (config.rateLimit) {
      this.rateLimiters.set(config.name, {
        lastRun: Date.now(),
        count: 0,
      });
    }
  }

  private async checkRateLimit(queueName: string): Promise<boolean> {
    const config = this.queueConfigs.get(queueName);
    const rateLimiter = this.rateLimiters.get(queueName);

    if (!config?.rateLimit || !rateLimiter) {
      return true;
    }

    const now = Date.now();
    if (now - rateLimiter.lastRun >= config.rateLimit.interval) {
      // Reset counter for new interval
      rateLimiter.count = 0;
      rateLimiter.lastRun = now;
    }

    if (rateLimiter.count >= config.rateLimit.max) {
      logger.warn(
        "File: priorityQueueManager.ts",
        "⚠️",
        "71",
        "checkRateLimit",
        "queueName",
        `Rate limit exceeded for queue: ${queueName}`
      );
      return false;
    }

    rateLimiter.count++;
    return true;
  }

  async addTask(
    queueName: string,
    task: Task,
    options: TaskOptions = {}
  ): Promise<Job | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      logger.error(
        "File: priorityQueueManager.ts",
        "❌",
        "84",
        "addTask",
        "queueName",
        `Queue not found: ${queueName}`
      );
      return null;
    }

    if (!(await this.checkRateLimit(queueName))) {
      logger.warn(
        "File: priorityQueueManager.ts",
        "⏳",
        "89",
        "addTask",
        "queueName",
        `Task delayed due to rate limiting: ${queueName}`
      );
      // Could implement delayed retry logic here
      return null;
    }

    try {
      const jobOptions: JobsOptions = {
        priority: options.priority,
        attempts: options.maxRetries,
        backoff: options.backoff,
        removeOnComplete: true,
      };

      const job = await queue.add(task.name, task, jobOptions);

      logger.info(
        "File: priorityQueueManager.ts",
        "✅",
        "102",
        "addTask",
        "jobId",
        `Task added successfully: ${job.id}`
      );
      return job;
    } catch (error) {
      logger.error(
        "File: priorityQueueManager.ts",
        "❌",
        "106",
        "addTask",
        "error",
        `Failed to add task: ${error}`
      );
      throw error;
    }
  }

  async getQueueMetrics(queueName: string) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return null;
    }

    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);

    const config = this.queueConfigs.get(queueName);
    const rateLimiter = this.rateLimiters.get(queueName);

    return {
      name: queueName,
      priority: config?.priority || 0,
      metrics: {
        waiting,
        active,
        completed,
        failed,
      },
      rateLimit: rateLimiter
        ? {
            current: rateLimiter.count,
            max: config?.rateLimit?.max,
            interval: config?.rateLimit?.interval,
          }
        : null,
    };
  }

  async close(): Promise<void> {
    logger.info(
      "File: priorityQueueManager.ts",
      "🔒",
      "144",
      "close",
      "",
      "Closing all queues"
    );

    await Promise.all([
      ...Array.from(this.queues.values()).map((queue) => queue.close()),
      ...Array.from(this.workers.values()).map((worker) => worker.close()),
    ]);

    this.queues.clear();
    this.workers.clear();
    this.rateLimiters.clear();
  }

  async getTaskState(jobId: string): Promise<TaskState> {
    const job = this.queues.get(jobId);
    if (!job) {
      log(
        LogLevel.ERROR,
        `priorityQueueManager.ts: 🔌 60 getTaskState; jobId, ${jobId}`,
        "Invalid task ID"
      );
      throw new Error("Invalid task ID");
    }
    const state = await job.getJobState(jobId);
    log(
      LogLevel.INFO,
      `priorityQueueManager.ts: 🔌 65 getTaskState; jobId, ${jobId}, state, ${state}`,
      JSON.stringify({ jobId, state })
    );
    return state as TaskState;
  }

  async updateJobState(jobId: string, state: TaskState): Promise<void> {
    const queue = this.queues.get(jobId);
    if (queue) {
      const job = await queue.getJob(jobId);
      if (job) {
        await job.updateData({ ...job.data, state });
        log(
          LogLevel.INFO,
          `priorityQueueManager.ts 🔌: 170 updateJobState; jobId, ${jobId}, state, ${state}`,
          JSON.stringify({ jobId, state })
        );
      } else {
        log(
          LogLevel.ERROR,
          `priorityQueueManager.ts 🔌: 173 updateJobState; jobId, ${jobId}`,
          "Job not found"
        );
        throw new Error("Job not found");
      }
    } else {
      log(
        LogLevel.ERROR,
        `priorityQueueManager.ts 🔌: 173 updateJobState; jobId, ${jobId}`,
        "Queue not found"
      );
      throw new Error("Queue not found");
    }
  }
}
