import { Job } from 'bullmq';
import { Task } from '../types/interfaces';
export declare class DependencyManager {
    private dependencyQueue;
    constructor();
    addTaskWithDependencies(task: Task, dependencies: string[], timeout?: number): Promise<Job>;
    checkDependencies(dependencies: string[]): Promise<boolean>;
    getDependencyStatus(taskId: string): Promise<{
        completed: string[];
        pending: string[];
        failed: string[];
    }>;
    close(): Promise<void>;
}
