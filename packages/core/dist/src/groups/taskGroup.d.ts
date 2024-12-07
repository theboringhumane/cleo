import { Redis } from "ioredis";
import { TaskStatus } from "../types/enums";
import type { Task } from "../types/interfaces";
import type { Worker } from "../workers";
import { QueueManager } from "../queue/queueManager";
export interface GroupStats {
    total: number;
    active: number;
    completed: number;
    failed: number;
    paused: number;
}
export declare class TaskGroup {
    private redis;
    private groupKey;
    private stateKey;
    private processingKey;
    private processingOrderKey;
    private queueManager;
    private worker;
    constructor(redis: Redis, groupName: string);
    /**
     * Connect this group to a QueueManager and Worker
     */
    connect(queueManager: QueueManager, worker: Worker): void;
    addTask(taskId: string): Promise<void>;
    private updateStats;
    removeTask(taskId: string): Promise<void>;
    getTasks(): Promise<string[]>;
    getTasksWithDetails(): Promise<Task[]>;
    getTaskStatus(taskId: string): Promise<TaskStatus | null>;
    updateTaskStatus(taskId: string, status: TaskStatus): Promise<void>;
    private mapTaskStatusToState;
    getStats(): Promise<GroupStats>;
    processNextTask(): Promise<void>;
    startProcessing(): Promise<void>;
    pauseAll(): Promise<void>;
    resumeAll(): Promise<void>;
    getNextTask(): Promise<string | null>;
    completeTask(taskId: string): Promise<void>;
    hasAvailableTasks(): Promise<boolean>;
}
