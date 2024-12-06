/**
 * Represents the possible states of a task in the queue
 */
export declare enum TaskState {
    PENDING = "PENDING",
    RUNNING = "RUNNING",
    SUCCESS = "SUCCESS",
    FAILURE = "FAILURE",
    RETRY = "RETRY",
    SCHEDULED = "SCHEDULED",
    CANCELLED = "CANCELLED"
}
/**
 * Represents the priority levels for tasks
 */
export declare enum TaskPriority {
    LOW = 1,
    NORMAL = 2,
    HIGH = 3,
    CRITICAL = 4
}
/**
 * Represents the available log levels
 */
export declare enum LogLevel {
    ERROR = "error",
    WARN = "warn",
    INFO = "info",
    DEBUG = "debug"
}
/**
 * Represents the possible worker states
 */
export declare enum WorkerState {
    IDLE = "IDLE",
    BUSY = "BUSY",
    STOPPED = "STOPPED",
    ERROR = "ERROR"
}
/**
 * Represents the possible queue events
 */
export declare enum QueueEvent {
    TASK_ADDED = "TASK_ADDED",
    TASK_STARTED = "TASK_STARTED",
    TASK_COMPLETED = "TASK_COMPLETED",
    TASK_FAILED = "TASK_FAILED",
    TASK_RETRYING = "TASK_RETRYING",
    WORKER_CONNECTED = "WORKER_CONNECTED",
    WORKER_DISCONNECTED = "WORKER_DISCONNECTED"
}
