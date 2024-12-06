import winston from 'winston';
import { LogLevel } from '../types/enums';
interface ExtendedLogger extends winston.Logger {
    requestTracker: (req: any, res: any, next: any) => void;
}
declare const logger: ExtendedLogger;
export declare function log(level: LogLevel, message: string, metadata?: any): void;
export { logger };
export type { ExtendedLogger };
