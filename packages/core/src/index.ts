import { task } from "./decorators/task";
import { QueueManager } from "./queue/queueManager";
import { Worker } from "./workers";
import type {
  Task,
  TaskOptions,
  WorkerConfig,
  QueueMetrics,
} from "./types/interfaces";
import { logger } from "./utils/logger";
import { redisConnection, RedisInstance } from "./config/redis";
import { initializeTaskDecorator } from "./decorators/task";

// Create a Cleo class to manage configuration
class Cleo {
  private static instances: Map<string, Cleo> = new Map();
  protected queueManager: QueueManager | null = null;
  private isConfigured = false;
  private readonly instanceId: RedisInstance;

  constructor(instanceId: RedisInstance = RedisInstance.DEFAULT) {
    this.instanceId = instanceId;
  }

  static getInstance(instanceId: RedisInstance = RedisInstance.DEFAULT): Cleo {
    if (!Cleo.instances.has(instanceId)) {
      logger.info(
        "File: index.ts 🔄, Line: 22, Function: getInstance; Creating new Cleo instance",
        { instanceId }
      );
      Cleo.instances.set(instanceId, new Cleo(instanceId));
    }
    return Cleo.instances.get(instanceId)!;
  }

  configure(config: {
    redis: {
      host: string;
      port: number;
      password?: string;
      tls?: boolean;
      db?: number;
    };
    worker?: WorkerConfig;
  }): void {
    try {
      logger.info(
        "File: index.ts ⚙️, Line: 36, Function: configure; Configuring Cleo instance",
        {
          instanceId: this.instanceId,
          redisHost: config.redis.host,
          redisPort: config.redis.port,
        }
      );

      if (!config.redis.host || !config.redis.port) {
        throw new Error("Redis host and port are required");
      }

      // Store instance-specific Redis configuration
      const redisConfig = {
        REDIS_HOST: config.redis.host,
        REDIS_PORT: config.redis.port.toString(),
        REDIS_PASSWORD: config.redis.password,
        REDIS_TLS: config.redis.tls ? "true" : undefined,
        REDIS_DB: config.redis.db?.toString(),
        INSTANCE_ID: this.instanceId,
      };

      logger.info(
        "File: index.ts 🔌, Line: 43, Function: configure; Redis configuration",
        { redisConfig }
      );

      // Initialize Redis connection for this instance
      redisConnection.initializeInstance(this.instanceId, redisConfig);

      this.queueManager = new QueueManager('default', this.instanceId, {
      }, config.worker);

      // Initialize task decorator with this instance
      initializeTaskDecorator(this);

      this.isConfigured = true;
      logger.info(
        "File: index.ts ✅, Line: 56, Function: configure; Cleo configuration complete",
        { instanceId: this.instanceId }
      );
    } catch (error) {
      logger.error(
        "File: index.ts ❌, Line: 58, Function: configure; Configuration failed",
        { error, instanceId: this.instanceId }
      );
      throw error;
    }
  }

  getInstanceId(): string {
    return this.instanceId;
  }

  getQueueManager(): QueueManager {
    if (!this.isConfigured) {
      logger.error(
        "File: index.ts ⚠️, Line: 64, Function: getQueueManager; Cleo must be configured before using"
      );
      throw new Error("Cleo must be configured before using");
    }
    return this.queueManager!;
  }

  getWorker(queueName: string): Worker {
    return this.queueManager!.getWorker(queueName);
  }

  // Method decorator
  task = task;
}

// Export the core functionality
export {
  Cleo,
  Task,
  TaskOptions,
  WorkerConfig,
  QueueMetrics,
  redisConnection,
};

// Export the queue manager
export { QueueManager } from './queue/queueManager';

// Export the task group functionality
export { TaskGroup } from './groups/taskGroup';

// Export the observer types
export {
  TaskObserver,
  type TaskObserverCallback
} from './observers/taskObserver';

// Export all enums from a single source
export {
  TaskState,
  TaskStatus,
  TaskPriority,
  LogLevel,
  ObserverEvent,
  GroupOperation,
  WorkerState,
} from './types/enums';

// Export the worker
export { Worker } from './workers';

/**
 * Example usage:
 * 
 * // Create a queue manager
 * const queueManager = new QueueManager('default');
 * 
 * // Subscribe to task events
 * queueManager.onTaskEvent(ObserverEvent.STATUS_CHANGE, (taskId, status, data) => {
 *   console.log(`Task ${taskId} status changed to ${status}`);
 * });
 * 
 * // Create a task group and add tasks
 * await queueManager.addTaskToGroup('task-1', 'important-tasks');
 * await queueManager.addTaskToGroup('task-2', 'important-tasks');
 * 
 * // Get all tasks in a group
 * const tasks = await queueManager.getGroupTasks('important-tasks');
 * 
 * // Remove a task from a group
 * await queueManager.removeTaskFromGroup('task-1', 'important-tasks');
 */
