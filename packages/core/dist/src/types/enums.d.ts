/**
 * Represents the possible states of a task in the queue
 */
export declare enum TaskState {
    COMPLETED = "completed",
    FAILED = "failed",
    DELAYED = "delayed",
    ACTIVE = "active",
    WAITING = "waiting",
    WAITING_CHILDREN = "waiting-children",
    UNKNOWN = "unknown"
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
export declare enum TaskStatus {
    WAITING = "waiting",
    ACTIVE = "active",
    COMPLETED = "completed",
    FAILED = "failed",
    DELAYED = "delayed",
    PAUSED = "paused",
    STALLED = "stalled"
}
export declare enum ObserverEvent {
    TASK_ADDED = "task_added",
    STATUS_CHANGE = "status_change",
    PROGRESS_UPDATE = "progress_update",
    GROUP_CHANGE = "group_change",
    TASK_COMPLETED = "task_completed",
    TASK_FAILED = "task_failed",
    TASK_PROGRESS = "task_progress",
    TASK_STALLED = "task_stalled"
}
export declare enum GroupOperation {
    ADD = "add",
    REMOVE = "remove",
    PAUSE = "pause",
    RESUME = "resume",
    CLEAR = "clear"
}
export declare enum GroupProcessingStrategy {
    ROUND_ROBIN = "ROUND_ROBIN",
    FIFO = "FIFO",// Default First-In-First-Out
    PRIORITY = "PRIORITY"
}
