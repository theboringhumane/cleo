import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

export interface QueueMetricsData {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  averageWaitingTime: number;
  timestamp: number;
}

export class QueueMetrics {
  private readonly redis: Redis;
  private readonly metricsKeyPrefix = 'queue:metrics';
  private readonly retentionPeriod = 7 * 24 * 60 * 60; // 7 days in seconds

  constructor(redis: Redis) {
    this.redis = redis;
  }

  private getMetricsKey(queueName: string): string {
    return `${this.metricsKeyPrefix}:${queueName}`;
  }

  async saveMetrics(queueName: string, metrics: QueueMetricsData): Promise<void> {
    try {
      const key = this.getMetricsKey(queueName);
      const score = metrics.timestamp;
      const value = JSON.stringify(metrics);

      // Store metrics in a sorted set with timestamp as score
      await this.redis.zadd(key, score, value);

      // Remove old metrics beyond retention period
      const cutoffTime = Date.now() - (this.retentionPeriod * 1000);
      await this.redis.zremrangebyscore(key, '-inf', cutoffTime);

      logger.debug("📊 QueueMetrics: Metrics saved", {
        file: "queueMetrics.ts",
        function: "saveMetrics",
        queue: queueName,
        metrics,
      });
    } catch (error) {
      logger.error("❌ QueueMetrics: Failed to save metrics", {
        file: "queueMetrics.ts",
        function: "saveMetrics",
        queue: queueName,
        error,
      });
    }
  }

  async getMetrics(queueName: string, timeRange?: { start?: number; end?: number } ): Promise<QueueMetricsData[]> {
    try {
      const key = this.getMetricsKey(queueName);
      const start = timeRange?.start ?? '-inf';
      const end = timeRange?.end ?? '+inf';

      const metricsData = await this.redis.zrangebyscore(key, start, end);
      
      return metricsData.map(data => JSON.parse(data));
    } catch (error) {
      logger.error("❌ QueueMetrics: Failed to get metrics", {
        file: "queueMetrics.ts",
        function: "getMetrics",
        queue: queueName,
        error,
      });
      return [];
    }
  }

  async getLatestMetrics(queueName: string): Promise<QueueMetricsData | null> {
    try {
      const key = this.getMetricsKey(queueName);
      const latestMetrics = await this.redis.zrevrange(key, 0, 0);
      
      if (latestMetrics.length === 0) {
        return null;
      }

      return JSON.parse(latestMetrics[0]);
    } catch (error) {
      logger.error("❌ QueueMetrics: Failed to get latest metrics", {
        file: "queueMetrics.ts",
        function: "getLatestMetrics",
        queue: queueName,
        error,
      });
      return null;
    }
  }

  async getAllQueueMetrics(): Promise<Record<string, QueueMetricsData>> {
    try {
      const keys = await this.redis.keys(`${this.metricsKeyPrefix}:*`);
      const result: Record<string, QueueMetricsData> = {};

      for (const key of keys) {
        const queueName = key.replace(`${this.metricsKeyPrefix}:`, '');
        const metrics = await this.getLatestMetrics(queueName);
        if (metrics) {
          result[queueName] = metrics;
        }
      }

      return result;
    } catch (error) {
      logger.error("❌ QueueMetrics: Failed to get all queue metrics", {
        file: "queueMetrics.ts",
        function: "getAllQueueMetrics",
        error,
      });
      return {};
    }
  }
} 