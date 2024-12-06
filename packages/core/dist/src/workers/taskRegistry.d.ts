import { Task } from '../types/interfaces';
export declare class TaskRegistry {
    private tasks;
    constructor();
    registerTask(name: string, handler: Function): void;
    getTaskHandler(name: string): Function | undefined;
    execute(task: Task): Promise<any>;
}
