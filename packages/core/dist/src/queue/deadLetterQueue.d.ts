import { Job } from 'bullmq';
import { Task } from '../types/interfaces';
import { EventEmitter } from 'events';
interface DeadLetterConfig {
    maxRetries: number;
    backoff: {
        type: 'exponential' | 'fixed';
        delay: number;
    };
    alertThreshold: number;
}
export declare class DeadLetterQueue extends EventEmitter {
    private dlq;
    private config;
    private alertCount;
    constructor(config: DeadLetterConfig);
    addFailedTask(task: Task, error: Error, originalQueue: string): Promise<Job | null>;
    retryTask(jobId: string): Promise<boolean>;
    getFailedTasks(limit?: number, offset?: number): Promise<Job[]>;
    purgeOldEntries(maxAge: number): Promise<number>;
    getStats(): Promise<{
        totalFailed: number;
        recentFailures: number;
        oldestEntry: Date | null;
    }>;
    close(): Promise<void>;
}
export {};
