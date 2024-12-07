import Redis from 'ioredis';
import { logger } from '../utils/logger';

export enum RedisInstance {
  DEFAULT = 'default',
  QUEUE = 'queue',
  WORKER = 'worker',
  CACHE = 'cache'
}

export interface RedisConfig {
  REDIS_HOST: string;
  REDIS_PORT: string;
  REDIS_PASSWORD?: string;
  REDIS_TLS?: string;
  REDIS_DB?: string;
  INSTANCE_ID: string;
}

export class RedisConnection {
  private connections: Map<string, Redis> = new Map();

  initializeInstance(instanceId: RedisInstance | string, config: RedisConfig): Redis {
    logger.info(
      "File: redis.ts 🔌, Line: 15, Function: initializeInstance; Initializing Redis connection",
      { instanceId }
    );

    const redisConfig = {
      host: config.REDIS_HOST,
      port: parseInt(config.REDIS_PORT, 10),
      password: config.REDIS_PASSWORD,
      tls: config.REDIS_TLS === 'true' ? {} : undefined,
      db: config.REDIS_DB ? parseInt(config.REDIS_DB, 10) : 0,
    };

    const connection = new Redis(redisConfig);
    this.connections.set(instanceId, connection);

    logger.info(
      "File: redis.ts 🔌, Line: 39, Function: initializeInstance; Redis connection initialized",
      { instanceId }
    );

    connection.on('error', (error) => {
      logger.error(
        "File: redis.ts ❌, Line: 30, Function: initializeInstance; Redis connection error",
        { error, instanceId }
      );
    });

    return connection;
  }

  getConfig(instanceId: RedisInstance | string = RedisInstance.DEFAULT): RedisConfig {
    return this.connections.get(instanceId)?.options as RedisConfig;
  }

  getInstance(instanceId: RedisInstance | string = RedisInstance.DEFAULT): Redis {
    const connection = this.connections.get(instanceId);
    if (!connection) {
      throw new Error(`Redis connection not initialized for instance: ${instanceId}`);
    }
    return connection;
  }
}

export const redisConnection = new RedisConnection();

export type RedisConnectionType = typeof redisConnection;