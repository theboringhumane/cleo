import { QueueClassOptions } from "../types/interfaces";
/**
 * Class decorator that automatically queues all methods of a class
 */
export declare function QueueClass(options?: QueueClassOptions): <T extends {
    new (...args: any[]): any;
}>(constructor: T) => {
    new (...args: any[]): {
        [x: string]: any;
    };
} & T;
