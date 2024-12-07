import { Worker as BullWorker } from "bullmq";
import { WorkerConfig } from "../types/interfaces";
import { TaskObserver } from "../observers/taskObserver";
import { QueueManager } from "../queue/queueManager";
export declare class Worker extends BullWorker {
    private registeredTasks;
    private observer;
    private queueManager;
    constructor(queueName: string, config?: WorkerConfig, instanceId?: string);
    private canProcessGroupedTask;
    setQueueManager(queueManager: QueueManager): void;
    getTaskHandler(taskId: string): Function | undefined;
    setObservers(observer: TaskObserver): void;
    registerTask(name: string, handler: Function): void;
    getRegisteredTasks(): string[];
}
