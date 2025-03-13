import { Redis } from "ioredis";
import { TaskStatus, TaskState, GroupProcessingStrategy } from "../types/enums";
import { logger } from "../utils/logger";
import type { Task, TaskOptions } from "../types/interfaces";
import type { Worker } from "../workers";
import { QueueManager } from "../queue/queueManager";
import { retryWithBackoff } from "../utils/retryWithBackoff";

export interface GroupStats {
  total: number;
  active: number;
  completed: number;
  failed: number;
  paused: number;
}

export interface GroupConfig {
  name: string;
  concurrency?: number;
  maxConcurrency?: number;
  rateLimit?: {
    max: number;
    duration: number;
  };
  priority?: number;
  strategy?: GroupProcessingStrategy;
  retryDelay?: number;
  retryLimit?: number;
  timeout?: number;
}

export class TaskGroup {
  private redis: Redis;
  private groupKey: string;
  private stateKey: string;
  private processingKey: string;
  private processingOrderKey: string;
  private queueManager: QueueManager | null = null;
  private worker: Worker | null = null;
  private config: GroupConfig;
  private rateLimitKey: string;
  private lockKey: string;
  private isProcessing: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(redis: Redis, config: GroupConfig) {
    this.redis = redis;
    this.config = {
      concurrency: 1,
      maxConcurrency: 10,
      priority: 0,
      strategy: GroupProcessingStrategy.FIFO,
      retryDelay: 3000,
      retryLimit: 3,
      timeout: 300000,
      ...config,
    };

    const { name } = this.config;
    this.groupKey = `group:${name}:tasks`;
    this.stateKey = `group:${name}:state`;
    this.processingKey = `group:${name}:processing`;
    this.processingOrderKey = `group:${name}:order`;
    this.rateLimitKey = `group:${name}:rateLimit`;
    this.lockKey = `group:${name}:lock`;

    logger.info("👥 TaskGroup: initialized", {
      file: "taskGroup.ts",
      line: 20,
      function: "constructor",
      groupName: name,
      config: this.config,
    });
  }

  /**
   * Connect this group to a QueueManager and Worker
   */
  connect(queueManager: QueueManager, worker: Worker): void {
    this.queueManager = queueManager;
    this.worker = worker;
    logger.info("🔌 TaskGroup: connected to QueueManager and Worker", {
      file: "taskGroup.ts",
      line: 45,
      function: "connect",
    });
  }

  private async acquireLock(timeout: number = 5000): Promise<boolean> {
    const lockValue = Date.now().toString();
    const acquired = await this.redis.set(
      this.lockKey,
      lockValue,
      "PX",
      timeout,
      "NX"
    );
    return !!acquired;
  }

  private async releaseLock(): Promise<void> {
    await this.redis.del(this.lockKey);
  }

  private async checkRateLimit(): Promise<boolean> {
    if (!this.config.rateLimit) return true;

    const { max, duration } = this.config.rateLimit;
    const now = Date.now();
    const windowStart = now - duration;

    // Remove old entries
    await this.redis.zremrangebyscore(this.rateLimitKey, "-inf", windowStart);

    // Count current entries
    const count = await this.redis.zcard(this.rateLimitKey);

    return count < max;
  }

  private async trackRateLimit(): Promise<void> {
    if (!this.config.rateLimit) return;

    const now = Date.now();
    await this.redis.zadd(this.rateLimitKey, now.toString(), now.toString());
  }

  async addTask(
    methodName: string,
    taskOptions: TaskOptions,
    taskData: any
  ): Promise<void> {
    try {
      const { id: taskId, queue: queueName, weight = 1 } = taskOptions;

      if (!taskId || !queueName) {
        throw new Error("Task ID and queue name are required");
      }

      // Check rate limit and acquire lock
      if (!(await this.checkRateLimit())) {
        throw new Error(`Rate limit exceeded for group ${this.config.name}`);
      }

      if (!(await this.acquireLock())) {
        throw new Error("Failed to acquire lock for task addition");
      }

      try {
        // Just add to group structures
        await this.redis.sadd(this.groupKey, taskId);

        const timestamp = Date.now();
        const priorityScore = (this.config.priority || 0) * 1000000000000;
        const weightScore = weight * 10000000000;
        const orderScore = priorityScore + weightScore + timestamp;

        await this.redis.zadd(
          this.processingOrderKey,
          orderScore.toString(),
          taskId
        );
        await this.redis.hset(this.stateKey, taskId, TaskStatus.WAITING);

        // Store task details for later queue addition
        await this.redis.hset(`${this.groupKey}:tasks:${taskId}`, {
          method: methodName,
          data: JSON.stringify(taskData),
          options: JSON.stringify(taskOptions),
        });

        await this.updateStats();
      } finally {
        await this.releaseLock();
      }
    } catch (error) {
      logger.error("❌ TaskGroup: Failed to add task", {
        file: "taskGroup.ts",
        function: "addTask",
        taskId: taskOptions.id,
        error,
      });
      throw error;
    }
  }

  async getAllTasks(): Promise<
    [taskId: string, queue: string, taskData: any, taskMethod: string][]
  > {
    // get all tasks from redis
    const tasks = await this.redis.hgetall(this.stateKey);
    const taskIds = Object.keys(tasks);

    const result: [
      taskId: string,
      queue: string,
      taskData: any,
      taskMethod: string
    ][] = [];

    for (const taskId of taskIds) {
      const options = await this.redis.hget(`${this.groupKey}:options`, taskId);
      const taskData = await this.redis.hget(`${this.groupKey}:data`, taskId);
      const taskMethod = await this.redis.hget(
        `${this.groupKey}:method`,
        taskId
      );
      result.push([
        taskId,
        JSON.parse(options!)["queue"],
        JSON.parse(taskData!),
        taskMethod!,
      ]);
    }

    return result;
  }

  private async updateStats(): Promise<void> {
    try {
      const tasks = await this.redis.hgetall(this.stateKey);
      const stats: GroupStats = {
        total: Object.keys(tasks).length,
        active: 0,
        completed: 0,
        failed: 0,
        paused: 0,
      };

      Object.values(tasks).forEach((status) => {
        switch (status) {
          case TaskStatus.ACTIVE:
            stats.active++;
            break;
          case TaskStatus.COMPLETED:
            stats.completed++;
            break;
          case TaskStatus.FAILED:
            stats.failed++;
            break;
          case TaskStatus.PAUSED:
            stats.paused++;
            break;
        }
      });

      // Store stats in Redis
      await this.redis.hmset(`${this.groupKey}:stats`, stats);

      logger.debug("📊 TaskGroup: stats updated", {
        file: "taskGroup.ts",
        line: 150,
        function: "updateStats",
        stats,
      });
    } catch (error) {
      logger.error("❌ TaskGroup: failed to update stats", {
        file: "taskGroup.ts",
        line: 159,
        function: "updateStats",
        error,
      });
    }
  }

  async removeTask(taskId: string): Promise<void> {
    try {
      await Promise.all([
        this.redis.srem(this.groupKey, taskId),
        this.redis.hdel(this.stateKey, taskId),
        this.redis.zrem(this.processingOrderKey, taskId),
        this.redis.srem(this.processingKey, taskId),
      ]);

      logger.debug("➖ TaskGroup: task removed", {
        file: "taskGroup.ts",
        line: 54,
        function: "removeTask",
        taskId,
      });
    } catch (error) {
      logger.error("❌ TaskGroup: failed to remove task", {
        file: "taskGroup.ts",
        line: 61,
        function: "removeTask",
        taskId,
        error,
      });
      throw error;
    }
  }

  async getTasks(): Promise<string[]> {
    try {
      return await this.redis.smembers(this.groupKey);
    } catch (error) {
      logger.error("❌ TaskGroup: failed to get tasks", {
        file: "taskGroup.ts",
        line: 74,
        function: "getTasks",
        error,
      });
      throw error;
    }
  }

  async getTaskOptionsAndData(taskId: string): Promise<{
    options: TaskOptions;
    data: any;
    method: string | null;
  } | null> {
    const options = await this.redis.hget(`${this.groupKey}:options`, taskId);
    const data = await this.redis.hget(`${this.groupKey}:data`, taskId);
    const method = await this.redis.hget(`${this.groupKey}:method`, taskId);
    return options && data
      ? { options: JSON.parse(options), data: JSON.parse(data), method }
      : null;
  }

  async getTasksWithDetails(): Promise<Task[]> {
    try {
      if (!this.queueManager) {
        throw new Error("TaskGroup not connected to QueueManager");
      }

      const taskIds = await this.getTasks();
      const tasks = await Promise.all(
        taskIds.map((id) => this.queueManager!.getTask(id))
      );

      return tasks.filter((task): task is Task => task !== null);
    } catch (error) {
      logger.error("❌ TaskGroup: failed to get tasks with details", {
        file: "taskGroup.ts",
        line: 74,
        function: "getTasksWithDetails",
        error,
      });
      throw error;
    }
  }

  async getTaskStatus(taskId: string): Promise<TaskStatus | null> {
    try {
      const status = await this.redis.hget(this.stateKey, taskId);
      return status as TaskStatus | null;
    } catch (error) {
      logger.error("❌ TaskGroup: failed to get task status", {
        file: "taskGroup.ts",
        line: 87,
        function: "getTaskStatus",
        taskId,
        error,
      });
      throw error;
    }
  }

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
    try {
      const exists = await this.redis.sismember(this.groupKey, taskId);
      if (!exists) {
        throw new Error(`Task ${taskId} not found in group`);
      }
      await this.redis.hset(this.stateKey, taskId, status);

      // Update task state in QueueManager if connected
      if (this.queueManager) {
        const task = await this.queueManager.getTask(taskId);
        if (task) {
          task.state = this.mapTaskStatusToState(status);
          await this.queueManager.updateTask(task);
        }
      }

      // Update group stats
      await this.updateStats();

      logger.debug("🔄 TaskGroup: task status updated", {
        file: "taskGroup.ts",
        line: 104,
        function: "updateTaskStatus",
        taskId,
        status,
      });
    } catch (error) {
      logger.error("❌ TaskGroup: failed to update task status", {
        file: "taskGroup.ts",
        line: 112,
        function: "updateTaskStatus",
        taskId,
        status,
        error,
      });
      throw error;
    }
  }

  private mapTaskStatusToState(status: TaskStatus): TaskState {
    switch (status) {
      case TaskStatus.ACTIVE:
        return TaskState.ACTIVE;
      case TaskStatus.COMPLETED:
        return TaskState.COMPLETED;
      case TaskStatus.FAILED:
        return TaskState.FAILED;
      case TaskStatus.WAITING:
        return TaskState.WAITING;
      case TaskStatus.DELAYED:
        return TaskState.DELAYED;
      default:
        return TaskState.UNKNOWN;
    }
  }

  async getStats(): Promise<GroupStats> {
    try {
      // Try to get cached stats first
      const cachedStats = await this.redis.hgetall(`${this.groupKey}:stats`);
      if (Object.keys(cachedStats).length > 0) {
        return {
          total: parseInt(cachedStats.total) || 0,
          active: parseInt(cachedStats.active) || 0,
          completed: parseInt(cachedStats.completed) || 0,
          failed: parseInt(cachedStats.failed) || 0,
          paused: parseInt(cachedStats.paused) || 0,
        };
      }

      // If no cached stats, calculate them
      await this.updateStats();
      return this.getStats();
    } catch (error) {
      logger.error("❌ TaskGroup: failed to get stats", {
        file: "taskGroup.ts",
        line: 159,
        function: "getStats",
        error,
      });
      throw error;
    }
  }

  async getNextTask(): Promise<
    [string, string, any, string, TaskOptions] | null
  > {
    return retryWithBackoff(
      async () => {
        const multi = this.redis.multi();

        try {
          await this.redis.watch(this.processingOrderKey);

          // Check concurrency limits
          const processing = await this.redis.scard(this.processingKey);
          if (processing >= (this.config.maxConcurrency || 10)) {
            await this.redis.unwatch();
            return null;
          }

          // Get tasks based on strategy
          let tasks: string[] = [];
          switch (this.config.strategy) {
            case GroupProcessingStrategy.LIFO:
              tasks = await this.redis.zrange(this.processingOrderKey, -1, -1);
              break;
            case GroupProcessingStrategy.PRIORITY:
              tasks = await this.redis.zrevrange(this.processingOrderKey, 0, 0);
              break;
            case GroupProcessingStrategy.ROUND_ROBIN:
              // Get all tasks and their scores
              const allTasks = await this.redis.zrange(
                this.processingOrderKey,
                0,
                -1,
                'WITHSCORES'
              );
              
              if (allTasks.length === 0) {
                tasks = [];
              } else {
                // Find the task with the oldest processing time
                let oldestTime = Infinity;
                let selectedTask = null;
                
                for (let i = 0; i < allTasks.length; i += 2) {
                  const taskId = allTasks[i];
                  const score = parseInt(allTasks[i + 1]);
                  
                  if (score < oldestTime) {
                    oldestTime = score;
                    selectedTask = taskId;
                  }
                }
                
                if (selectedTask) {
                  tasks = [selectedTask];
                  // Update the processing time for the selected task
                  await this.redis.zadd(
                    this.processingOrderKey,
                    Date.now().toString(),
                    selectedTask
                  );
                }
              }
              break;
            case GroupProcessingStrategy.FIFO:
            default:
              tasks = await this.redis.zrange(this.processingOrderKey, 0, 0);
          }

          if (tasks.length === 0) {
            await this.redis.unwatch();
            return null;
          }

          const nextTask = tasks[0];
          const now = Date.now();

          multi.zrem(this.processingOrderKey, nextTask);
          multi.sadd(this.processingKey, nextTask);
          multi.hset(
            `${this.groupKey}:processing_start`,
            nextTask,
            now.toString()
          );

          const results = await multi.exec();

          if (!results) {
            logger.debug("⚠️ TaskGroup: Concurrent modification detected", {
              file: "taskGroup.ts",
              function: "getNextTask",
            });
            throw new Error("Concurrent modification detected");
          }

          const taskOptions = await this.getTaskOptionsAndData(nextTask);
          if (!taskOptions) return null;

          const { options } = taskOptions;

          logger.debug("🎯 TaskGroup: Selected next task", {
            file: "taskGroup.ts",
            function: "getNextTask",
            taskId: nextTask,
            weight: options.weight || 1,
            strategy: this.config.strategy,
          });

          return [
            nextTask,
            options.queue!,
            taskOptions.data,
            taskOptions.method!,
            options,
          ];
        } catch (error) {
          logger.error("❌ TaskGroup: Failed to get next task", {
            file: "taskGroup.ts",
            function: "getNextTask",
            error,
          });
          throw error;
        }
      },
      3,
      100
    );
  }

  async processNextTask(): Promise<void> {
    if (!this.queueManager || !this.worker) {
      throw new Error("TaskGroup not connected to QueueManager and Worker");
    }

    try {
      // Check if we can process more tasks
      const processing = await this.redis.scard(this.processingKey);
      if (processing >= (this.config.concurrency || 1)) {
        return;
      }

      // Check rate limit
      if (!(await this.checkRateLimit())) {
        return;
      }

      const nextTask = await this.getNextTask();
      if (!nextTask) return;

      const [nextTaskId, queueName, taskData, taskMethod, taskOptions] =
        nextTask;

      // Update task status to processing
      await this.updateTaskStatus(nextTaskId, TaskStatus.ACTIVE);

      // Track rate limit
      await this.trackRateLimit();

      // Add task to queue with group configuration
      const enhancedOptions = {
        ...taskOptions,
        timeout: taskOptions.timeout || this.config.timeout,
        maxRetries: taskOptions.maxRetries || this.config.retryLimit,
        retryDelay: taskOptions.retryDelay || this.config.retryDelay,
      };

      const task = {
        id: nextTaskId,
        name: taskMethod,
        data: taskData,
        options: enhancedOptions,
        state: TaskState.ACTIVE,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Instead of processing directly, ensure the task is in the queue
      await this.queueManager.ensureTaskInQueue(task, queueName);

      logger.debug("🚀 TaskGroup: Processing task", {
        file: "taskGroup.ts",
        function: "processNextTask",
        taskId: nextTaskId,
        queueName,
        strategy: this.config.strategy,
        concurrency: await this.redis.scard(this.processingKey),
      });
    } catch (error) {
      logger.error("❌ TaskGroup: failed to process next task", {
        file: "taskGroup.ts",
        line: 190,
        function: "processNextTask",
        error,
      });
      throw error;
    }
  }

  async startProcessing(): Promise<void> {
    if (!this.queueManager || !this.worker) {
      throw new Error("TaskGroup not connected to QueueManager and Worker");
    }

    if (this.isProcessing) return;

    this.isProcessing = true;
    this.processingInterval = setInterval(() => {
      this.processNextBatch().catch(error => {
        logger.error("❌ TaskGroup: Error in processing interval", {
          file: "taskGroup.ts",
          function: "startProcessing",
          error
        });
      });
    }, 1000);

    await this.processNextBatch();
  }

  async stopProcessing(): Promise<void> {
    this.isProcessing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  private async processNextBatch(): Promise<void> {
    if (!this.isProcessing) return;

    try {
      const promises: Promise<void>[] = [];
      const concurrency = this.config.concurrency || 1;

      // Process up to concurrency limit
      for (let i = 0; i < concurrency; i++) {
        promises.push(this.processNextTask());
      }

      await Promise.all(promises);

      logger.debug("✅ TaskGroup: Processed batch", {
        file: "taskGroup.ts",
        function: "processNextBatch",
        groupName: this.config.name,
        concurrency
      });
    } catch (error) {
      logger.error("❌ TaskGroup: Failed to process batch", {
        file: "taskGroup.ts",
        function: "processNextBatch",
        error
      });
    }
  }

  async pauseAll(): Promise<void> {
    try {
      const taskIds = await this.getTasks();
      await Promise.all(
        taskIds.map((taskId) =>
          this.updateTaskStatus(taskId, TaskStatus.PAUSED)
        )
      );
      logger.info("⏸️ TaskGroup: all tasks paused", {
        file: "taskGroup.ts",
        line: 173,
        function: "pauseAll",
        tasksCount: taskIds.length,
      });
    } catch (error) {
      logger.error("❌ TaskGroup: failed to pause all tasks", {
        file: "taskGroup.ts",
        line: 180,
        function: "pauseAll",
        error,
      });
      throw error;
    }
  }

  async resumeAll(): Promise<void> {
    try {
      const taskIds = await this.getTasks();
      await Promise.all(
        taskIds.map((taskId) =>
          this.updateTaskStatus(taskId, TaskStatus.ACTIVE)
        )
      );
      logger.info("▶️ TaskGroup: all tasks resumed", {
        file: "taskGroup.ts",
        line: 194,
        function: "resumeAll",
        tasksCount: taskIds.length,
      });
    } catch (error) {
      logger.error("❌ TaskGroup: failed to resume all tasks", {
        file: "taskGroup.ts",
        line: 201,
        function: "resumeAll",
        error,
      });
      throw error;
    }
  }

  async completeTask(taskId: string): Promise<void> {
    if (!(await this.acquireLock())) {
      throw new Error("Failed to acquire lock for task completion");
    }

    try {
      // Update task status
      await this.updateTaskStatus(taskId, TaskStatus.COMPLETED);

      // Remove from processing order and group
      await this.redis.zrem(this.processingOrderKey, taskId);
      await this.redis.srem(this.groupKey, taskId);

      // Clean up task data
      await this.redis.hdel(`${this.groupKey}:options`, taskId);
      await this.redis.hdel(`${this.groupKey}:data`, taskId);
      await this.redis.hdel(`${this.groupKey}:method`, taskId);

      // Update stats
      await this.updateStats();

      logger.debug("✅ TaskGroup: Task completed", {
        file: "taskGroup.ts",
        function: "completeTask",
        taskId,
        group: this.config.name,
      });
    } finally {
      await this.releaseLock();
    }
  }

  async failTask(taskId: string, error: Error): Promise<void> {
    try {
      const taskOptions = await this.getTaskOptionsAndData(taskId);
      if (!taskOptions) {
        throw new Error(`Task ${taskId} not found`);
      }

      const retryCount = await this.redis.hincrby(
        `${this.groupKey}:retries`,
        taskId,
        1
      );

      if (retryCount <= (this.config.retryLimit || 3)) {
        // Retry the task
        await Promise.all([
          this.redis.srem(this.processingKey, taskId),
          this.redis.hdel(`${this.groupKey}:processing_start`, taskId),
          this.redis.zadd(
            this.processingOrderKey,
            Date.now().toString(),
            taskId
          ),
        ]);

        logger.info("🔄 TaskGroup: Retrying failed task", {
          file: "taskGroup.ts",
          function: "failTask",
          taskId,
          retryCount,
          maxRetries: this.config.retryLimit,
        });

        // Wait for retry delay
        await new Promise((resolve) =>
          setTimeout(resolve, this.config.retryDelay || 3000)
        );

        // Process the task again
        await this.processNextTask();
      } else {
        // Mark as failed after max retries
        await Promise.all([
          this.redis.srem(this.processingKey, taskId),
          this.redis.hdel(`${this.groupKey}:processing_start`, taskId),
          this.updateTaskStatus(taskId, TaskStatus.FAILED),
        ]);

        // Move to dead letter queue if available
        if (this.queueManager?.deadLetterQueue) {
          const { options } = taskOptions;
          await this.queueManager.deadLetterQueue.addFailedTask(
            taskOptions.data,
            error,
            options.queue!
          );
        }

        logger.error("❌ TaskGroup: Task failed permanently", {
          file: "taskGroup.ts",
          function: "failTask",
          taskId,
          error,
          retries: retryCount,
        });
      }
    } catch (error) {
      logger.error("❌ TaskGroup: Error handling task failure", {
        file: "taskGroup.ts",
        function: "failTask",
        taskId,
        error,
      });
      throw error;
    }
  }

  async recoverStuckTasks(maxProcessingTime: number = 300000): Promise<void> {
    try {
      const processingTasks = await this.redis.smembers(this.processingKey);
      const now = Date.now();

      for (const taskId of processingTasks) {
        const startTime = await this.redis.hget(
          `${this.groupKey}:processing_start`,
          taskId
        );
        if (!startTime) continue;

        const processingDuration = now - parseInt(startTime);
        if (processingDuration > (this.config.timeout || maxProcessingTime)) {
          // Get task details
          const taskOptions = await this.getTaskOptionsAndData(taskId);
          if (!taskOptions) continue;

          logger.warn("⚠️ TaskGroup: Found stuck task", {
            file: "taskGroup.ts",
            function: "recoverStuckTasks",
            taskId,
            processingDuration,
            timeout: this.config.timeout,
          });

          // Handle as failure
          await this.failTask(
            taskId,
            new Error(`Task timed out after ${processingDuration}ms`)
          );
        }
      }
    } catch (error) {
      logger.error("❌ TaskGroup: Failed to recover stuck tasks", {
        file: "taskGroup.ts",
        function: "recoverStuckTasks",
        error,
      });
    }
  }

  async cleanup(): Promise<void> {
    try {
      // Get all keys related to this group
      const keys = await this.redis.keys(`group:${this.config.name}:*`);

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      logger.info("🧹 TaskGroup: Cleaned up group data", {
        file: "taskGroup.ts",
        function: "cleanup",
        groupName: this.config.name,
        keysRemoved: keys.length,
      });
    } catch (error) {
      logger.error("❌ TaskGroup: Failed to cleanup group", {
        file: "taskGroup.ts",
        function: "cleanup",
        error,
      });
      throw error;
    }
  }

  async hasAvailableTasks(): Promise<boolean> {
    const taskIds = await this.redis.smembers(this.groupKey);
    const processing = await this.redis.smembers(this.processingKey);
    return taskIds.length > processing.length;
  }

  async updateConfig(updates: Partial<GroupConfig>): Promise<void> {
    this.config = {
      ...this.config,
      ...updates,
    };

    logger.debug("⚙️ TaskGroup: Configuration updated", {
      file: "taskGroup.ts",
      function: "updateConfig",
      groupName: this.config.name,
      updates,
    });
  }
}
