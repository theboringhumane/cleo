import { Redis, RedisOptions } from 'ioredis';
import { logger } from '../utils/logger';
import { redisConnection } from '../config/redis';

interface CacheConfig {
  enabled: boolean;
  ttl: number;  // time to live in seconds
  strategy: 'memory' | 'redis';
  maxSize?: number;  // max entries for memory cache
}

interface CacheEntry {
  result: any;
  timestamp: number;
}

export class ResultCache {
  private config: CacheConfig;
  private memoryCache: Map<string, CacheEntry>;
  private redis: Redis;

  constructor(config: CacheConfig) {
    this.config = {
      enabled: config.enabled,
      ttl: config.ttl || 3600, // 1 hour default
      strategy: config.strategy || 'memory',
      maxSize: config.maxSize || 1000,
    };

    this.memoryCache = new Map();
    
    // Use the existing authenticated Redis connection
    this.redis = redisConnection.getInstance('default');

    logger.info('File: resultCache.ts', '💾', '25', 'constructor', 'config', 
      `Result cache initialized with strategy: ${this.config.strategy}`);
  }

  private getCacheKey(taskName: string, params: any): string {
    const paramString = JSON.stringify(params);
    return `task_result:${taskName}:${paramString}`;
  }

  async get(taskName: string, params: any): Promise<any | null> {
    if (!this.config.enabled) {
      return null;
    }

    const cacheKey = this.getCacheKey(taskName, params);

    try {
      if (this.config.strategy === 'memory') {
        return this.getFromMemory(cacheKey);
      } else {
        return this.getFromRedis(cacheKey);
      }
    } catch (error) {
      logger.error('File: resultCache.ts', '❌', '47', 'get', 'error',
        `Cache get error: ${error}`);
      return null;
    }
  }

  async set(taskName: string, params: any, result: any): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const cacheKey = this.getCacheKey(taskName, params);
    const entry: CacheEntry = {
      result,
      timestamp: Date.now(),
    };

    try {
      if (this.config.strategy === 'memory') {
        await this.setInMemory(cacheKey, entry);
      } else {
        await this.setInRedis(cacheKey, entry);
      }

      logger.info('File: resultCache.ts', '✅', '69', 'set', 'taskName',
        `Cached result for task: ${taskName}`);
    } catch (error) {
      logger.error('File: resultCache.ts', '❌', '72', 'set', 'error',
        `Cache set error: ${error}`);
    }
  }

  private async getFromMemory(key: string): Promise<any | null> {
    const entry = this.memoryCache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() - entry.timestamp > this.config.ttl * 1000) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.result;
  }

  private async getFromRedis(key: string): Promise<any | null> {
    const data = await this.redis.get(key);
    if (!data) {
      return null;
    }

    const entry: CacheEntry = JSON.parse(data);
    if (Date.now() - entry.timestamp > this.config.ttl * 1000) {
      await this.redis.del(key);
      return null;
    }

    return entry.result;
  }

  private async setInMemory(key: string, entry: CacheEntry): Promise<void> {
    // Implement LRU-like cleanup if cache is full
    if (this.memoryCache.size >= (this.config.maxSize || 1000)) {
      const oldestKey = Array.from(this.memoryCache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
      this.memoryCache.delete(oldestKey);
    }

    this.memoryCache.set(key, entry);
  }

  private async setInRedis(key: string, entry: CacheEntry): Promise<void> {
    await this.redis.set(
      key,
      JSON.stringify(entry),
      'EX',
      this.config.ttl
    );
  }

  async invalidate(taskName: string, params?: any): Promise<void> {
    try {
      if (params) {
        const key = this.getCacheKey(taskName, params);
        if (this.config.strategy === 'memory') {
          this.memoryCache.delete(key);
        } else {
          await this.redis.del(key);
        }
      } else {
        // Invalidate all entries for this task
        const pattern = `task_result:${taskName}:*`;
        if (this.config.strategy === 'memory') {
          for (const key of this.memoryCache.keys()) {
            if (key.startsWith(`task_result:${taskName}:`)) {
              this.memoryCache.delete(key);
            }
          }
        } else {
          const keys = await this.redis.keys(pattern);
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        }
      }

      logger.info('File: resultCache.ts', '🗑️', '143', 'invalidate', 'taskName',
        `Invalidated cache for task: ${taskName}`);
    } catch (error) {
      logger.error('File: resultCache.ts', '❌', '146', 'invalidate', 'error',
        `Cache invalidation error: ${error}`);
    }
  }

  async clear(): Promise<void> {
    try {
      if (this.config.strategy === 'memory') {
        this.memoryCache.clear();
      } else {
        const keys = await this.redis.keys('task_result:*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }

      logger.info('File: resultCache.ts', '🧹', '161', 'clear', '',
        'Cache cleared');
    } catch (error) {
      logger.error('File: resultCache.ts', '❌', '164', 'clear', 'error',
        `Cache clear error: ${error}`);
    }
  }

  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
} 