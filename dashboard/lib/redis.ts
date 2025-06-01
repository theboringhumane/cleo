import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis = globalForRedis.redis ?? new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  keyPrefix: process.env.REDIS_KEY_PREFIX,
});

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

// Constants for Redis keys
export const KEYS = {
  QUEUES_SET: 'queues:set',
  QUEUE_PREFIX: 'queue:',
  TASK_PREFIX: 'task:',
  GROUP_PREFIX: 'group:',
  WORKER_PREFIX: 'worker:',
  METRICS_PREFIX: 'metrics:',
} as const;

// Helper functions for key generation
export const generateKeys = {
  queueKey: (queueName: string) => `${KEYS.QUEUE_PREFIX}${queueName}`,
  taskKey: (taskId: string) => `${KEYS.TASK_PREFIX}${taskId}`,
  groupKey: (groupName: string) => `${KEYS.GROUP_PREFIX}${groupName}`,
  workerKey: (workerId: string) => `${KEYS.WORKER_PREFIX}${workerId}`,
  metricsKey: (type: string, id: string) => `${KEYS.METRICS_PREFIX}${type}:${id}`,
};

// Helper functions for common Redis operations
export const redisHelpers = {
  async getJSON<T>(key: string): Promise<T | null> {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  },

  async setJSON(key: string, value: any, ttl?: number): Promise<void> {
    const data = JSON.stringify(value);
    if (ttl) {
      await redis.set(key, data, 'EX', ttl);
    } else {
      await redis.set(key, data);
    }
  },

  async getHashAsObject<T>(key: string): Promise<T | null> {
    const data = await redis.hgetall(key);
    return Object.keys(data).length > 0 ? data as unknown as T : null;
  },

  async setHashFromObject(key: string, obj: Record<string, any>): Promise<void> {
    if (Object.keys(obj).length > 0) {
      await redis.hmset(key, obj);
    }
  },

  async getList<T>(key: string, start = 0, end = -1): Promise<T[]> {
    const data = await redis.lrange(key, start, end);
    return data.map(item => JSON.parse(item));
  },

  async addToList(key: string, value: any): Promise<void> {
    await redis.rpush(key, JSON.stringify(value));
  },

  async getSetMembers<T>(key: string): Promise<T[]> {
    const members = await redis.smembers(key);
    return members.map(member => JSON.parse(member));
  },

  async addToSet(key: string, value: any): Promise<void> {
    await redis.sadd(key, JSON.stringify(value));
  },

  async removeFromSet(key: string, value: any): Promise<void> {
    await redis.srem(key, JSON.stringify(value));
  },
};

export default redis; 