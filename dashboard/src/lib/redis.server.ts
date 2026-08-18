import Redis from 'ioredis'

let redis: Redis | null = null

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableOfflineQueue: true,
    })
  }
  return redis
}

export const KEYS = {
  QUEUES_SET: 'cleo:queues:all',
  QUEUE_META_PREFIX: 'cleo:queue:meta:',
  QUEUE_WORKERS_PREFIX: 'cleo:queue:workers:',
  WORKERS_SET: 'cleo:workers:all',
  WORKER_KEY: 'cleo:worker',
  TASK_HISTORY_KEY: 'cleo:task:history:',
  GROUP_PREFIX: 'group:',
} as const

export function bullConnection() {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    maxRetriesPerRequest: null,
  }
}

export function safeParse(raw: string): any | null {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
