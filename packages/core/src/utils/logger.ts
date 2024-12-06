import winston from 'winston';
import { LogLevel } from '../types/enums';

// Extend the Winston Logger type
interface ExtendedLogger extends winston.Logger {
  requestTracker: (req: any, res: any, next: any) => void;
}

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    const metaString = Object.keys(metadata).length ? JSON.stringify(metadata) : '';
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaString}`;
  })
);

const logger: ExtendedLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || LogLevel.INFO,
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.colorize({ all: true }),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: LogLevel.ERROR,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
}) as ExtendedLogger;

// Add request tracking middleware
logger.requestTracker = (req: any, res: any, next: any) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('File: logger.ts 🌐, Line: 33, Function: requestTracker;', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
    });
  });
  next();
};

// Helper function for consistent logging format
export function log(level: LogLevel, message: string, metadata?: any): void {
  logger.log(level, message, metadata);
}

export { logger };
export type { ExtendedLogger };
