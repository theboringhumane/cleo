import { TaskProgress } from '../types/interfaces';
import { EventEmitter } from 'events';
export declare class ProgressTracker extends EventEmitter {
    private wss;
    private clients;
    private taskProgress;
    private metrics;
    constructor(port?: number);
    private setupWebSocket;
    updateProgress(taskId: string, progress: number, metrics?: {
        cpuUsage?: number;
        memoryUsage?: number;
    }): void;
    private calculateEstimatedCompletion;
    private broadcast;
    getProgress(taskId: string): TaskProgress | null;
    getAllProgress(): TaskProgress[];
    clearProgress(taskId: string): void;
    close(): void;
}
