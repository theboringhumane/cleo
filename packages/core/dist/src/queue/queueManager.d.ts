import { Queue, QueueOptions } from "bullmq";
import { Task, TaskOptions, WorkerConfig } from "../types/interfaces";
import { ObserverEvent, GroupProcessingStrategy } from "../types/enums";
import { RedisInstance } from "../config/redis";
import { TaskObserverCallback } from '../observers/taskObserver';
import { TaskGroup } from '../groups/taskGroup';
import { Worker } from "../workers";
export declare class QueueManager {
    private queues;
    private observer;
    private groups;
    private groupProcessingStrategy;
    private redis;
    private instanceId;
    private workers;
    private isProcessing;
    private activeGroups;
    private groupOrderKey;
    private groupInfos;
    constructor(defaultQueueName?: string, redisInstance?: RedisInstance, queueOptions?: QueueOptions, workerOptions?: WorkerConfig);
    initializeQueue(queueName: string, queueOptions?: QueueOptions, workerOptions?: WorkerConfig, instanceId?: string): void;
    private initializeWorker;
    getWorker(queueName?: string): Worker;
    getQueue(queueName: string): Queue | null;
    addTask(name: string, data: any, options?: TaskOptions): Promise<Task>;
    getTask(taskId: string, queueName?: string): Promise<Task | null>;
    getAllTasks(): Promise<Task[]>;
    removeTask(taskId: string, queueName?: string): Promise<boolean>;
    getGroup(groupName: string): Promise<TaskGroup>;
    getGroupTasks(groupName: string): Promise<Task[]>;
    addTaskToGroup(taskId: string, groupName: string): Promise<void>;
    private getNextGroupByStrategy;
    /**
     * Gets the next task to process based on the current group processing strategy
     * This method is used by tests and external integrations
     */
    getNextGroupTask(): Promise<Task | null>;
    private getNextRoundRobinGroup;
    private getNextFifoGroup;
    private getNextPriorityGroup;
    processGroupTasks(): Promise<void>;
    private getGroupPriority;
    setGroupPriority(groupName: string, priority: number): Promise<void>;
    setGroupProcessingStrategy(strategy: GroupProcessingStrategy): void;
    onTaskEvent(event: ObserverEvent, callback: TaskObserverCallback): void;
    offTaskEvent(event: ObserverEvent): void;
    private setupTaskObservers;
    private processTask;
    updateTask(task: Task): Promise<void>;
    close(): Promise<void>;
    completeGroupTask(taskId: string, groupName: string): Promise<void>;
}
