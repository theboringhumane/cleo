interface CacheConfig {
    enabled: boolean;
    ttl: number;
    strategy: 'memory' | 'redis';
    maxSize?: number;
}
export declare class ResultCache {
    private config;
    private memoryCache;
    private redis;
    constructor(config: CacheConfig);
    private getCacheKey;
    get(taskName: string, params: any): Promise<any | null>;
    set(taskName: string, params: any, result: any): Promise<void>;
    private getFromMemory;
    private getFromRedis;
    private setInMemory;
    private setInRedis;
    invalidate(taskName: string, params?: any): Promise<void>;
    clear(): Promise<void>;
    close(): Promise<void>;
}
export {};
