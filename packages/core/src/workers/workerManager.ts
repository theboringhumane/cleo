import { Redis } from "ioredis";
import { redisConnection, RedisInstance } from "../config/redis";
import { QUEUE_WORKERS_PREFIX, QUEUES_SET_KEY, WORKER_KEY, WORKERS_SET_KEY, TASK_HISTORY_KEY } from "../constants";
import { TaskHistoryEntry, WorkerMetrics } from "../types/interfaces";
import { TaskHistoryService } from "../services/taskHistory";
import { logger } from "../utils/logger";

export class WorkerManager {
  private static instance: WorkerManager;
  private redis: Redis;
  private taskHistoryService: TaskHistoryService;

  private constructor(instanceId: RedisInstance = RedisInstance.DEFAULT) {
    this.redis = redisConnection.getInstance(instanceId);
    this.taskHistoryService = TaskHistoryService.getInstance();
  }

  public static getInstance(
    instanceId: RedisInstance = RedisInstance.DEFAULT
  ): WorkerManager {
    if (!WorkerManager.instance) {
      WorkerManager.instance = new WorkerManager(
        instanceId || RedisInstance.DEFAULT
      );
    }
    return WorkerManager.instance;
  }

  public async getStatus(workerId: string): Promise<string> {
    const status = await this.redis.get(`${WORKER_KEY}:${workerId}:status`);
    return status || "unknown";
  }

  public async getActiveTasks(workerId: string): Promise<string[]> {
    const activeTasks = await this.redis.smembers(
      `${WORKER_KEY}:${workerId}:activeTasks`
    );
    return activeTasks;
  }

  public async getMetrics(workerId: string): Promise<WorkerMetrics> {
    const metrics = await this.redis.hgetall(
      `${WORKER_KEY}:${workerId}:metrics`
    );
    return {
      tasksProcessed: parseInt(metrics.tasksProcessed || "0"),
      tasksSucceeded: parseInt(metrics.tasksSucceeded || "0"),
      tasksFailed: parseInt(metrics.tasksFailed || "0"),
      totalProcessingTime: parseInt(metrics.totalProcessingTime || "0"),
      averageProcessingTime: parseInt(metrics.averageProcessingTime || "0"),
    };
  }

  public async getLastHeartbeat(workerId: string): Promise<string> {
    const lastHeartbeat = await this.redis.get(`${WORKER_KEY}:${workerId}:lastHeartbeat`);
    return lastHeartbeat || "unknown";
  }

  /**
   * Get task history for a specific worker
   */
  async getTaskHistory(workerId: string, limit: number = 100): Promise<any[]> {
    try {
      return await this.taskHistoryService.getWorkerHistory(workerId, limit);
    } catch (error) {
      logger.error("❌ WorkerManager: Failed to get task history", {
        file: "workerManager.ts",
        function: "getTaskHistory",
        workerId,
        error,
      });
      return [];
    }
  }

  /**
   * Get task history for a specific task across all workers
   */
  async getTaskHistoryById(taskId: string, limit: number = 50): Promise<any[]> {
    try {
      return await this.taskHistoryService.getTaskHistory(taskId, limit);
    } catch (error) {
      logger.error("❌ WorkerManager: Failed to get task history by ID", {
        file: "workerManager.ts",
        function: "getTaskHistoryById",
        taskId,
        error,
      });
      return [];
    }
  }

  /**
   * Get global task history across all workers
   */
  async getGlobalTaskHistory(limit: number = 100): Promise<any[]> {
    try {
      return await this.taskHistoryService.getGlobalHistory(limit);
    } catch (error) {
      logger.error("❌ WorkerManager: Failed to get global task history", {
        file: "workerManager.ts",
        function: "getGlobalTaskHistory",
        error,
      });
      return [];
    }
  }

  /**
   * Get task history statistics
   */
  async getTaskHistoryStats(): Promise<{
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    averageDuration: number;
  }> {
    try {
      return await this.taskHistoryService.getHistoryStats();
    } catch (error) {
      logger.error("❌ WorkerManager: Failed to get task history stats", {
        file: "workerManager.ts",
        function: "getTaskHistoryStats",
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

  public async getMetricsHistory(workerId: string): Promise<WorkerMetrics[]> {
    const metricsHistory = await this.redis.lrange(`${WORKER_KEY}:${workerId}:metricsHistory`, 0, -1);
    return metricsHistory.map((entry: string) => JSON.parse(entry));
  }

  public async getWorkerQueue(workerId: string): Promise<string> {
    const allQueues = await this.redis.keys(`${QUEUE_WORKERS_PREFIX}*`);
    let workerQueue = "unknown";

    for (const queueKey of allQueues) {
      const workers = await this.redis.smembers(queueKey);
      if (workers.includes(workerId)) {
        workerQueue = queueKey.replace(QUEUE_WORKERS_PREFIX, "");
        break;
      }
    }
    
    return workerQueue || "unknown";
  }
}
