import { Queue, JobsOptions } from "bullmq";
import { Task, TaskOptions } from "../types/interfaces";
import { TaskState } from "../types/enums";
import { logger } from "../utils/logger";
import { redisConnection } from "../config/redis";

export class QueueManager {
  private queues: Map<string, Queue>;

  constructor(defaultQueueName: string) {
    logger.info("File: queueManager.ts 🎯, Line: 9, Function: constructor;", {
      defaultQueueName,
    });

    this.queues = new Map();
    this.initializeQueue(defaultQueueName);
  }

  private initializeQueue(queueName: string): void {
    const queue = new Queue(queueName, {
      connection: redisConnection,
    });
    this.queues.set(queueName, queue);
    logger.info(
      "File: queueManager.ts 🆕, Line: 19, Function: initializeQueue;",
      {
        queueName,
        message: "Queue initialized",
      }
    );
  }

  async addTask(
    name: string,
    data: any,
    options: TaskOptions = {}
  ): Promise<Task> {
    const queueName = options.queue || "default";
    let queue = this.queues.get(queueName);

    if (!queue) {
      this.initializeQueue(queueName);
      queue = this.queues.get(queueName);
    }

    const task: Task = {
      id: options.id || `${name}-${Date.now()}`,
      name,
      data,
      options,
      state: TaskState.PENDING,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    logger.info("File: queueManager.ts ➕, Line: 42, Function: addTask;", {
      taskId: task.id,
      taskName: task.name,
      queueName,
    });

    const jobOptions: JobsOptions = {
      priority: options.priority,
      attempts: options.maxRetries,
      backoff: {
        type: "exponential",
        delay: options.retryDelay || 1000,
      },
      removeOnComplete: true,
      repeat: options.schedule ? { pattern: options.schedule } : undefined,
    };

    if (!queue) {
      logger.error("File: queueManager.ts ❌, Line: 50, Function: addTask;", {
        queueName,
        message: "Queue not found",
      });
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.add(name, task, jobOptions);

    return task;
  }

  async getTask(
    taskId: string,
    queueName: string = "default"
  ): Promise<Task | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      logger.error("File: queueManager.ts ❌, Line: 65, Function: getTask;", {
        queueName,
        message: "Queue not found",
      });
      return null;
    }

    const job = await queue.getJob(taskId);
    if (!job) {
      logger.warn("File: queueManager.ts ⚠️, Line: 73, Function: getTask;", {
        taskId,
        queueName,
        message: "Task not found",
      });
      return null;
    }

    return job.data as Task;
  }

  async getTasks(queueName: string = "default"): Promise<Task[]> {
    const queue = this.queues.get(queueName);
    const jobs = (await queue?.getJobs()) || [];
    return jobs.map((job) => job.data as Task);
  }

  async getAllTasks(): Promise<Task[]> {
    const allTasks = await Promise.all(
      Array.from(this.queues.values()).map(async (queue) => queue.getJobs())
    );
    return allTasks.flat().map((job) => job.data as Task);
  }

  async removeTask(
    taskId: string,
    queueName: string = "default"
  ): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      logger.error(
        "File: queueManager.ts ❌, Line: 87, Function: removeTask;",
        {
          queueName,
          message: "Queue not found",
        }
      );
      return false;
    }

    const job = await queue.getJob(taskId);
    if (!job) {
      logger.warn("File: queueManager.ts ⚠️, Line: 95, Function: removeTask;", {
        taskId,
        queueName,
        message: "Task not found",
      });
      return false;
    }

    await job.remove();
    logger.info("File: queueManager.ts 🗑️, Line: 103, Function: removeTask;", {
      taskId,
      queueName,
      message: "Task removed",
    });

    return true;
  }

  async close(): Promise<void> {
    logger.info("File: queueManager.ts 🔒, Line: 112, Function: close;", {
      message: "Closing all queues",
    });

    const closePromises = Array.from(this.queues.values()).map((queue) =>
      queue.close()
    );
    await Promise.all(closePromises);
    this.queues.clear();
  }

  getQueue(queueName: string): Queue | null {
    return this.queues.get(queueName) || null;
  }
}
