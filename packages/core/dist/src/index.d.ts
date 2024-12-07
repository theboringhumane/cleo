import { task } from "./decorators/task";
import { QueueManager } from "./queue/queueManager";
import { Worker } from "./workers";
import type { Task, TaskOptions, WorkerConfig, QueueMetrics } from "./types/interfaces";
import { redisConnection, RedisInstance } from "./config/redis";
declare class Cleo {
    private static instances;
    protected queueManager: QueueManager | null;
    private isConfigured;
    private readonly instanceId;
    constructor(instanceId?: RedisInstance);
    static getInstance(instanceId?: RedisInstance): Cleo;
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
    getInstanceId(): string;
    getQueueManager(): QueueManager;
    getWorker(queueName: string): Worker;
    task: typeof task;
}
export { Cleo, Task, TaskOptions, WorkerConfig, QueueMetrics, redisConnection, };
export { QueueManager } from './queue/queueManager';
export { TaskGroup } from './groups/taskGroup';
export { TaskObserver, type TaskObserverCallback } from './observers/taskObserver';
export { TaskState, TaskStatus, TaskPriority, LogLevel, ObserverEvent, GroupOperation, WorkerState, } from './types/enums';
export { Worker } from './workers';
/**
 * Example usage:
 *
 * // Create a queue manager
 * const queueManager = new QueueManager('default');
 *
 * // Subscribe to task events
 * queueManager.onTaskEvent(ObserverEvent.STATUS_CHANGE, (taskId, status, data) => {
 *   console.log(`Task ${taskId} status changed to ${status}`);
 * });
 *
 * // Create a task group and add tasks
 * await queueManager.addTaskToGroup('task-1', 'important-tasks');
 * await queueManager.addTaskToGroup('task-2', 'important-tasks');
 *
 * // Get all tasks in a group
 * const tasks = await queueManager.getGroupTasks('important-tasks');
 *
 * // Remove a task from a group
 * await queueManager.removeTaskFromGroup('task-1', 'important-tasks');
 */
