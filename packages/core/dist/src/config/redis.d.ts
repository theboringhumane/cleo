import Redis from 'ioredis';
export declare enum RedisInstance {
    DEFAULT = "default",
    QUEUE = "queue",
    WORKER = "worker",
    CACHE = "cache"
}
export interface RedisConfig {
    REDIS_HOST: string;
    REDIS_PORT: string;
    REDIS_PASSWORD?: string;
    REDIS_TLS?: string;
    REDIS_DB?: string;
    INSTANCE_ID: string;
}
export declare class RedisConnection {
    private connections;
    initializeInstance(instanceId: RedisInstance | string, config: RedisConfig): Redis;
    getConfig(instanceId?: RedisInstance | string): RedisConfig;
    getInstance(instanceId?: RedisInstance | string): Redis;
}
export declare const redisConnection: RedisConnection;
export type RedisConnectionType = typeof redisConnection;
