import { Queue } from "bullmq";
import { Task, TaskOptions } from "../types/interfaces";
export declare class QueueManager {
    private queues;
    constructor(defaultQueueName: string);
    private initializeQueue;
    addTask(name: string, data: any, options?: TaskOptions): Promise<Task>;
    getTask(taskId: string, queueName?: string): Promise<Task | null>;
    getTasks(queueName?: string): Promise<Task[]>;
    getAllTasks(): Promise<Task[]>;
    removeTask(taskId: string, queueName?: string): Promise<boolean>;
    close(): Promise<void>;
    getQueue(queueName: string): Queue | null;
}
