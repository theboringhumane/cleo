import { RedisInstance } from "../config/redis";

import Redis from "ioredis";
import { redisConnection } from "../config/redis";
import { QUEUE_WORKERS_PREFIX, QUEUES_SET_KEY, WORKER_KEY, WORKERS_SET_KEY } from "../constants";
import { TaskHistoryEntry, WorkerMetrics } from "../types/interfaces";

export class WorkerManager {
  private static instance: WorkerManager;
  private redis: Redis;
  private constructor(instanceId: RedisInstance = RedisInstance.DEFAULT) {
    this.redis = redisConnection.getInstance(instanceId);
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

  public async getTaskHistory(workerId: string): Promise<TaskHistoryEntry[]> {
    const taskHistory = await this.redis.lrange(`${WORKER_KEY}:${workerId}:taskHistory`, 0, -1);
    return taskHistory.map((entry: string) => JSON.parse(entry));
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
