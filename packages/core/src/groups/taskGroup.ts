import { Redis } from "ioredis";
import { TaskStatus, TaskState } from "../types/enums";
import { logger } from "../utils/logger";
import type { Task } from "../types/interfaces";
import type { Worker } from "../workers";
import { QueueManager } from "../queue/queueManager";

export interface GroupStats {
  total: number;
  active: number;
  completed: number;
  failed: number;
  paused: number;
}

export class TaskGroup {
  private redis: Redis;
  private groupKey: string;
  private stateKey: string;
  private processingKey: string;
  private processingOrderKey: string;
  private queueManager: QueueManager | null = null;
  private worker: Worker | null = null;

  constructor(redis: Redis, groupName: string) {
    this.redis = redis;
    this.groupKey = `group:${groupName}:tasks`;
    this.stateKey = `group:${groupName}:state`;
    this.processingKey = `group:${groupName}:processing`;
    this.processingOrderKey = `group:${groupName}:order`;
    logger.info("👥 TaskGroup: initialized", {
      file: "taskGroup.ts",
      line: 20,
      function: "constructor",
      groupName,
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

  async addTask(taskId: string): Promise<void> {
    try {
      await this.redis.sadd(this.groupKey, taskId);
      const orderScore = Date.now();
      await this.redis.zadd(this.processingOrderKey, orderScore.toString(), taskId);
      await this.redis.hset(this.stateKey, taskId, TaskStatus.WAITING);

      // If connected to QueueManager, update task state
      if (this.queueManager) {
        const task = await this.queueManager.getTask(taskId);
        if (task) {
          task.state = TaskState.WAITING;
          await this.queueManager.updateTask(task);
        }
      }

      // Update group stats
      await this.updateStats();

      logger.debug("➕ TaskGroup: task added", {
        file: "taskGroup.ts",
        line: 31,
        function: "addTask",
        taskId,
        groupKey: this.groupKey,
      });
    } catch (error) {
      logger.error("❌ TaskGroup: failed to add task", {
        file: "taskGroup.ts",
        line: 39,
        function: "addTask",
        taskId,
        error,
      });
      throw error;
    }
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

  async getTasksWithDetails(): Promise<Task[]> {
    try {
      if (!this.queueManager) {
        throw new Error("TaskGroup not connected to QueueManager");
      }

      const taskIds = await this.getTasks();
      const tasks = await Promise.all(
        taskIds.map(id => this.queueManager!.getTask(id))
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

  async processNextTask(): Promise<void> {
    if (!this.queueManager || !this.worker) {
      throw new Error("TaskGroup not connected to QueueManager and Worker");
    }

    try {
      const nextTaskId = await this.getNextTask();
      if (!nextTaskId) return;

      const task = await this.queueManager.getTask(nextTaskId);
      if (!task) {
        logger.warn("⚠️ TaskGroup: task not found", {
          file: "taskGroup.ts",
          line: 150,
          function: "processNextTask",
          taskId: nextTaskId,
        });
        return;
      }

      // Update task status to processing
      await this.updateTaskStatus(nextTaskId, TaskStatus.ACTIVE);
      task.state = TaskState.ACTIVE;
      await this.queueManager.updateTask(task);

      // Process the task using the worker
      const handler = this.worker.getTaskHandler(task.name);
      if (!handler) {
        throw new Error(`No handler found for task ${task.name}`);
      }

      try {
        const result = await handler(task.data.args);
        task.result = result;
        task.state = TaskState.COMPLETED;
        await this.completeTask(nextTaskId);
      } catch (error) {
        task.state = TaskState.FAILED;
        task.error = error instanceof Error ? error.message : String(error);
        await this.updateTaskStatus(nextTaskId, TaskStatus.FAILED);
      }

      await this.queueManager.updateTask(task);
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

    try {
      while (await this.hasAvailableTasks()) {
        await this.processNextTask();
      }

      logger.info("✅ TaskGroup: finished processing all tasks", {
        file: "taskGroup.ts",
        line: 210,
        function: "startProcessing",
      });
    } catch (error) {
      logger.error("❌ TaskGroup: failed to process tasks", {
        file: "taskGroup.ts",
        line: 216,
        function: "startProcessing",
        error,
      });
      throw error;
    }
  }

  async pauseAll(): Promise<void> {
    try {
      const taskIds = await this.getTasks();
      await Promise.all(
        taskIds.map((taskId) => this.updateTaskStatus(taskId, TaskStatus.PAUSED))
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
        taskIds.map((taskId) => this.updateTaskStatus(taskId, TaskStatus.ACTIVE))
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

  async getNextTask(): Promise<string | null> {
    try {
      const tasks = await this.redis.zrange(this.processingOrderKey, 0, 0);
      if (tasks.length === 0) return null;
      const nextTask = tasks[0];
      await this.redis.zrem(this.processingOrderKey, nextTask);
      await this.redis.sadd(this.processingKey, nextTask);
      
      logger.debug("⏭️ TaskGroup: next task selected", {
        file: "taskGroup.ts",
        line: 220,
        function: "getNextTask",
        taskId: nextTask
      });

      return nextTask;
    } catch (error) {
      logger.error("❌ TaskGroup: failed to get next task", {
        file: "taskGroup.ts",
        line: 230,
        function: "getNextTask",
        error
      });
      throw error;
    }
  }

  async completeTask(taskId: string): Promise<void> {
    try {
      await Promise.all([
        this.redis.srem(this.processingKey, taskId),
        this.updateTaskStatus(taskId, TaskStatus.COMPLETED)
      ]);

      logger.debug("✅ TaskGroup: task completed", {
        file: "taskGroup.ts",
        line: 248,
        function: "completeTask",
        taskId
      });
    } catch (error) {
      logger.error("❌ TaskGroup: failed to complete task", {
        file: "taskGroup.ts",
        line: 255,
        function: "completeTask",
        taskId,
        error
      });
      throw error;
    }
  }

  async hasAvailableTasks(): Promise<boolean> {
    const taskIds = await this.redis.smembers(this.groupKey);
    const processing = await this.redis.smembers(this.processingKey);
    return taskIds.length > processing.length;
  }
}
