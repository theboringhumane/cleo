import { Job } from "bullmq";
import { QueueConfig, Task, TaskOptions } from "../types/interfaces";
import { TaskState } from "../types/enums";
export declare class PriorityQueueManager {
    private queues;
    private workers;
    private rateLimiters;
    private queueConfigs;
    constructor(configs: QueueConfig[]);
    private initializeQueue;
    private checkRateLimit;
    addTask(queueName: string, task: Task, options?: TaskOptions): Promise<Job | null>;
    getQueueMetrics(queueName: string): Promise<{
        name: string;
        priority: number;
        metrics: {
            waiting: number;
            active: number;
            completed: number;
            failed: number;
        };
        rateLimit: {
            current: number;
            max: number | undefined;
            interval: number | undefined;
        } | null;
    } | null>;
    close(): Promise<void>;
    getTaskState(jobId: string): Promise<TaskState>;
    updateJobState(jobId: string, state: TaskState): Promise<void>;
}
