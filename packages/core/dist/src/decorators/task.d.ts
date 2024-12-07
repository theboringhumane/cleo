import { TaskOptions } from "../types/interfaces";
import { type Cleo } from "../index";
export declare function initializeTaskDecorator(instance: Cleo): void;
export declare function task(options?: TaskOptions): MethodDecorator;
