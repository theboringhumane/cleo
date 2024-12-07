import { Redis } from "ioredis";
import { ObserverEvent, TaskStatus } from "../types/enums";
export interface TaskObserverCallback {
    (taskId: string, status: TaskStatus, data?: any): void;
}
export declare class TaskObserver {
    private redis;
    private subscriberClient;
    private channelPrefix;
    private callbacks;
    constructor(redis: Redis);
    private setupSubscriber;
    subscribe(event: ObserverEvent, callback: TaskObserverCallback): void;
    unsubscribe(event: ObserverEvent): void;
    notify(event: ObserverEvent, taskId: string, status: TaskStatus, data?: any): void;
    private getChannelName;
    private getEventFromChannel;
    close(): Promise<void>;
}
