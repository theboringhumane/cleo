import { task } from './decorators/task';
import { QueueManager } from './queue/queueManager';
import { Worker } from './workers';
import { TaskState, TaskPriority, LogLevel } from './types/enums';
import type { Task, TaskOptions, WorkerConfig, QueueMetrics } from './types/interfaces';
import { redisConnection } from './config/redis';
declare class Cleo {
    private static instance;
    protected readonly queueManager: QueueManager;
    protected worker: Worker | null;
    private isConfigured;
    private constructor();
    static getInstance(): Cleo;
    configure(config: {
        redis: {
            host: string;
            port: number;
            password?: string;
            tls?: boolean;
            db?: number;
        };
        worker?: WorkerConfig;
    }): void;
    getQueueManager(): QueueManager;
    getWorker(): Worker | null;
    task: typeof task;
}
declare const cleo: Cleo;
export { cleo, Task, TaskOptions, WorkerConfig, QueueMetrics, TaskState, TaskPriority, LogLevel, redisConnection, Worker, };
