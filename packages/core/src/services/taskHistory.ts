import { Redis } from "ioredis";
import { redisConnection, RedisInstance } from "../config/redis";
import { TASK_HISTORY_KEY, TASK_HISTORY_EXPIRE } from "../constants";
import { TaskHistoryEntry } from "../types/interfaces";
import { logger } from "../utils/logger";

export interface ExtendedTaskHistoryEntry extends TaskHistoryEntry {
  workerId?: string;
  queueName?: string;
}

export class TaskHistoryService {
  private redis: Redis;
  private static instance: TaskHistoryService;

  private constructor(instanceId: RedisInstance = RedisInstance.DEFAULT) {
    this.redis = redisConnection.getInstance(instanceId);
  }

  static getInstance(instanceId: RedisInstance = RedisInstance.DEFAULT): TaskHistoryService {
    if (!TaskHistoryService.instance) {
      TaskHistoryService.instance = new TaskHistoryService(instanceId);
    }
    return TaskHistoryService.instance;
  }

  /**
   * Add a task history entry
   */
  async addTaskHistory(
    taskId: string,
    status: string,
    duration: number,
    workerId: string,
    queueName: string,
    error?: any,
    group?: string
  ): Promise<void> {
    try {
      const entry: ExtendedTaskHistoryEntry = {
        taskId,
        timestamp: new Date().toISOString(),
        status,
        duration,
        error: error ? (typeof error === 'string' ? error : error.message || JSON.stringify(error)) : undefined,
        group,
        workerId,
        queueName,
      };

      // Store in worker-specific task history
      const workerHistoryKey = `${TASK_HISTORY_KEY}${workerId}`;
      await this.redis.lpush(workerHistoryKey, JSON.stringify(entry));
      await this.redis.ltrim(workerHistoryKey, 0, 99); // Keep last 100 entries
      await this.redis.expire(workerHistoryKey, TASK_HISTORY_EXPIRE);

      // Store in task-specific history
      const taskHistoryKey = `${TASK_HISTORY_KEY}task:${taskId}`;
      await this.redis.lpush(taskHistoryKey, JSON.stringify(entry));
      await this.redis.ltrim(taskHistoryKey, 0, 50); // Keep last 50 entries per task
      await this.redis.expire(taskHistoryKey, TASK_HISTORY_EXPIRE);

      // Store in global history
      const globalHistoryKey = `${TASK_HISTORY_KEY}global`;
      await this.redis.lpush(globalHistoryKey, JSON.stringify(entry));
      await this.redis.ltrim(globalHistoryKey, 0, 1000); // Keep last 1000 global entries
      await this.redis.expire(globalHistoryKey, TASK_HISTORY_EXPIRE);

      // Store in queue-specific history
      const queueHistoryKey = `${TASK_HISTORY_KEY}queue:${queueName}`;
      await this.redis.lpush(queueHistoryKey, JSON.stringify(entry));
      await this.redis.ltrim(queueHistoryKey, 0, 500); // Keep last 500 entries per queue
      await this.redis.expire(queueHistoryKey, TASK_HISTORY_EXPIRE);

      // Store in group-specific history if group is provided
      if (group) {
        const groupHistoryKey = `${TASK_HISTORY_KEY}group:${group}`;
        await this.redis.lpush(groupHistoryKey, JSON.stringify(entry));
        await this.redis.ltrim(groupHistoryKey, 0, 200); // Keep last 200 entries per group
        await this.redis.expire(groupHistoryKey, TASK_HISTORY_EXPIRE);
      }

      logger.debug("📝 TaskHistory: Entry added", {
        file: "taskHistory.ts",
        function: "addTaskHistory",
        taskId,
        status,
        duration,
        workerId,
        queueName,
        group,
      });
    } catch (error) {
      logger.error("❌ TaskHistory: Failed to add entry", {
        file: "taskHistory.ts",
        function: "addTaskHistory",
        taskId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get task history for a specific worker
   */
  async getWorkerHistory(workerId: string, limit: number = 100): Promise<ExtendedTaskHistoryEntry[]> {
    try {
      const workerHistoryKey = `${TASK_HISTORY_KEY}${workerId}`;
      const history = await this.redis.lrange(workerHistoryKey, 0, limit - 1);
      return history.map((entry) => JSON.parse(entry));
    } catch (error) {
      logger.error("❌ TaskHistory: Failed to get worker history", {
        file: "taskHistory.ts",
        function: "getWorkerHistory",
        workerId,
        error,
      });
      return [];
    }
  }

  /**
   * Get task history for a specific task
   */
  async getTaskHistory(taskId: string, limit: number = 50): Promise<ExtendedTaskHistoryEntry[]> {
    try {
      const taskHistoryKey = `${TASK_HISTORY_KEY}task:${taskId}`;
      const history = await this.redis.lrange(taskHistoryKey, 0, limit - 1);
      return history.map((entry) => JSON.parse(entry));
    } catch (error) {
      logger.error("❌ TaskHistory: Failed to get task history", {
        file: "taskHistory.ts",
        function: "getTaskHistory",
        taskId,
        error,
      });
      return [];
    }
  }

  /**
   * Get global task history
   */
  async getGlobalHistory(limit: number = 100): Promise<ExtendedTaskHistoryEntry[]> {
    try {
      const globalHistoryKey = `${TASK_HISTORY_KEY}global`;
      const history = await this.redis.lrange(globalHistoryKey, 0, limit - 1);
      return history.map((entry) => JSON.parse(entry));
    } catch (error) {
      logger.error("❌ TaskHistory: Failed to get global history", {
        file: "taskHistory.ts",
        function: "getGlobalHistory",
        error,
      });
      return [];
    }
  }

  /**
   * Get task history for a specific queue
   */
  async getQueueHistory(queueName: string, limit: number = 500): Promise<ExtendedTaskHistoryEntry[]> {
    try {
      const queueHistoryKey = `${TASK_HISTORY_KEY}queue:${queueName}`;
      const history = await this.redis.lrange(queueHistoryKey, 0, limit - 1);
      return history.map((entry) => JSON.parse(entry));
    } catch (error) {
      logger.error("❌ TaskHistory: Failed to get queue history", {
        file: "taskHistory.ts",
        function: "getQueueHistory",
        queueName,
        error,
      });
      return [];
    }
  }

  /**
   * Get task history for a specific group
   */
  async getGroupHistory(group: string, limit: number = 200): Promise<ExtendedTaskHistoryEntry[]> {
    try {
      const groupHistoryKey = `${TASK_HISTORY_KEY}group:${group}`;
      const history = await this.redis.lrange(groupHistoryKey, 0, limit - 1);
      return history.map((entry) => JSON.parse(entry));
    } catch (error) {
      logger.error("❌ TaskHistory: Failed to get group history", {
        file: "taskHistory.ts",
        function: "getGroupHistory",
        group,
        error,
      });
      return [];
    }
  }

  /**
   * Get task history statistics
   */
  async getHistoryStats(): Promise<{
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    averageDuration: number;
  }> {
    try {
      const globalHistoryKey = `${TASK_HISTORY_KEY}global`;
      const history = await this.redis.lrange(globalHistoryKey, 0, -1);
      const entries: ExtendedTaskHistoryEntry[] = history.map((entry) => JSON.parse(entry));

      const stats = {
        totalTasks: entries.length,
        completedTasks: entries.filter(e => e.status === 'completed').length,
        failedTasks: entries.filter(e => e.status === 'failed').length,
        averageDuration: 0,
      };

      if (entries.length > 0) {
        const totalDuration = entries.reduce((sum, entry) => sum + entry.duration, 0);
        stats.averageDuration = totalDuration / entries.length;
      }

      return stats;
    } catch (error) {
      logger.error("❌ TaskHistory: Failed to get history stats", {
        file: "taskHistory.ts",
        function: "getHistoryStats",
        error,
      });
      return {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        averageDuration: 0,
      };
    }
  }

  /**
   * Clear task history for a specific worker
   */
  async clearWorkerHistory(workerId: string): Promise<void> {
    try {
      const workerHistoryKey = `${TASK_HISTORY_KEY}${workerId}`;
      await this.redis.del(workerHistoryKey);
      
      logger.info("🗑️ TaskHistory: Worker history cleared", {
        file: "taskHistory.ts",
        function: "clearWorkerHistory",
        workerId,
      });
    } catch (error) {
      logger.error("❌ TaskHistory: Failed to clear worker history", {
        file: "taskHistory.ts",
        function: "clearWorkerHistory",
        workerId,
        error,
      });
      throw error;
    }
  }

  /**
   * Clear all task history
   */
  async clearAllHistory(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${TASK_HISTORY_KEY}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      
      logger.info("🗑️ TaskHistory: All history cleared", {
        file: "taskHistory.ts",
        function: "clearAllHistory",
        keysDeleted: keys.length,
      });
    } catch (error) {
      logger.error("❌ TaskHistory: Failed to clear all history", {
        file: "taskHistory.ts",
        function: "clearAllHistory",
        error,
      });
      throw error;
    }
  }
} 