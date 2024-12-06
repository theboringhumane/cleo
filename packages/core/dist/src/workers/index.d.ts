import { WorkerConfig } from '../types/interfaces';
import { WorkerState } from '../types/enums';
export declare class Worker {
    private worker;
    private registry;
    private state;
    constructor(queueName: string, config: WorkerConfig);
    private setupEventHandlers;
    private processTask;
    registerTask(name: string, handler: Function): void;
    getState(): WorkerState;
    close(): Promise<void>;
}
