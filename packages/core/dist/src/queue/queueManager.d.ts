import { Task, TaskOptions } from '../types/interfaces';
export declare class QueueManager {
    private queues;
    constructor(defaultQueueName: string);
    addTask(name: string, data: any, options?: TaskOptions): Promise<Task>;
    getTask(taskId: string, queueName?: string): Promise<Task | null>;
    removeTask(taskId: string, queueName?: string): Promise<boolean>;
    close(): Promise<void>;
}
