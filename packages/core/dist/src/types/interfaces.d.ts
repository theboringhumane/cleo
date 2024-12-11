import { TaskState, TaskPriority, WorkerState } from "./enums";
import { RepeatOptions } from "bullmq";
/**
 * Configuration options for a task
 */
export interface TaskOptions {
    /** Unique identifier for the task */
    id?: string;
    /** Task priority level */
    priority?: TaskPriority;
    /** Number of retry attempts */
    retries?: number;
    /** Backoff configuration for retries */
    backoff?: {
        /** Type of backoff strategy */
        type: "exponential" | "fixed";
        /** Delay in milliseconds */
        delay: number;
    };
    /** Maximum retries allowed */
    maxRetries?: number;
    /** Delay between retries in milliseconds */
    retryDelay?: number;
    /** Timeout for task execution in milliseconds */
    timeout?: number;
    /** Cron expression for scheduled tasks */
    schedule?: RepeatOptions;
    /** Queue name for the task */
    queue?: string;
    /** Group name for the task */
    group?: string;
    /** Remove the task from the queue after completion */
    removeOnComplete?: boolean;
}
/**
 * Represents a task in the queue
 */
export interface Task<T = any> {
    /** Unique identifier for the task */
    id: string;
    /** Name of the task */
    name: string;
    /** Task input data */
    data: T;
    /** Task options */
    options: TaskOptions;
    /** Current state of the task */
    state: TaskState;
    /** Number of retry attempts made */
    retryCount: number;
    /** Timestamp when the task was created */
    createdAt: Date;
    /** Timestamp when the task was last updated */
    updatedAt: Date;
    /** Error message if task failed */
    error?: string;
    /** Result of the task execution */
    result?: any;
    /** Group name for the task */
    group?: string;
}
/**
 * Configuration for a worker
 */
export interface WorkerConfig {
    /** Number of concurrent tasks */
    concurrency?: number;
    /** Maximum memory usage in bytes */
    maxMemoryUsage?: number;
    /** Prefix for worker names */
    prefix?: string;
    /** Priority queue configurations */
    queues?: QueueConfig[];
}
/**
 * Metrics for a queue
 */
export interface QueueMetrics {
    /** Total number of tasks in the queue */
    totalTasks: number;
    /** Number of active tasks */
    activeTasks: number;
    /** Number of completed tasks */
    completedTasks: number;
    /** Number of failed tasks */
    failedTasks: number;
    /** Number of delayed tasks */
    delayedTasks: number;
    /** Average processing time in milliseconds */
    avgProcessingTime: number;
    /** Number of workers connected */
    connectedWorkers: number;
}
/**
 * Status of a worker
 */
export interface WorkerStatus {
    /** Unique identifier for the worker */
    id: string;
    /** Current state of the worker */
    state: WorkerState;
    /** Number of tasks processed */
    processedTasks: number;
    /** Current memory usage in bytes */
    memoryUsage: number;
    /** Timestamp when the worker started */
    startTime: Date;
    /** Current task being processed */
    currentTask?: Task;
}
/**
 * Event payload for queue events
 */
export interface QueueEventPayload {
    /** Type of the event */
    type: string;
    /** Timestamp of the event */
    timestamp: Date;
    /** Task associated with the event */
    task?: Task;
    /** Worker associated with the event */
    worker?: WorkerStatus;
    /** Additional metadata */
    metadata?: Record<string, any>;
}
/**
 * Rate limiting configuration for queues
 */
export interface RateLimitConfig {
    /** Maximum number of jobs to process per interval */
    max: number;
    /** Time interval in milliseconds */
    interval: number;
}
/**
 * Extended queue configuration with priority and rate limiting
 */
export interface QueueConfig {
    /** Queue name */
    name: string;
    /** Queue priority (higher number = higher priority) */
    priority: number;
    /** Optional rate limiting configuration */
    rateLimit?: RateLimitConfig;
    /** Maximum number of concurrent jobs */
    concurrency?: number;
    /** Queue-specific Redis configuration */
    redis?: {
        prefix?: string;
        db?: number;
    };
}
/**
 * Task progress information
 */
export interface TaskProgress {
    /** Task identifier */
    taskId: string;
    /** Progress percentage (0-100) */
    progress: number;
    /** Task metrics */
    metrics: {
        /** When the task started */
        startTime: Date;
        /** Estimated completion time */
        estimatedCompletion: Date;
        /** CPU usage percentage */
        cpuUsage: number;
        /** Memory usage in bytes */
        memoryUsage: number;
    };
}
/**
 * Options for the @QueueClass decorator
 */
export interface QueueClassOptions {
    /** Default options for all methods in the class */
    defaultOptions?: TaskOptions;
    /** Whether to include inherited methods */
    includeInherited?: boolean;
    /** Method names to exclude from queuing */
    exclude?: string[];
    /** Method names to include (if specified, only these methods will be queued) */
    include?: string[];
    /** Queue name for all methods */
    queue?: string;
    /** Group name for all tasks in this class. If not provided, uses the class name */
    group?: string;
}
/**
 * Worker interface
 */
export interface Worker {
    registerTask(name: string, handler: Function): void;
    getRegisteredTasks(): string[];
}
