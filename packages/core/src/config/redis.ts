import { ConnectionOptions } from 'bullmq';
import { logger } from '../utils/logger';

const DEFAULT_REDIS_PORT = 6379;
const DEFAULT_REDIS_HOST = 'localhost';

export function getRedisConfig(): ConnectionOptions {
  const {
    REDIS_HOST = DEFAULT_REDIS_HOST,
    REDIS_PORT = DEFAULT_REDIS_PORT,
    REDIS_PASSWORD,
    REDIS_TLS,
    REDIS_DB,
  } = process.env;

  logger.info('File: redis.ts 🔌, Line: 15, Function: getRedisConfig;', {
    host: REDIS_HOST,
    port: REDIS_PORT,
    tls: REDIS_TLS === 'true',
    db: REDIS_DB,
  });

  return {
    host: REDIS_HOST,
    port: Number(REDIS_PORT),
    password: REDIS_PASSWORD,
    tls: REDIS_TLS === 'true' ? {} : undefined,
    db: REDIS_DB ? Number(REDIS_DB) : undefined,
  };
}

export const redisConnection = getRedisConfig();
