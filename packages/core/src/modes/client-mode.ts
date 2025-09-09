import { QueueManager } from "../queue/queueManager";
import { redisConnection, RedisInstance } from "../config/redis";
import { logger } from "../utils/logger";

/**
 * Client mode for Cleo - only schedules jobs, no workers
 * Perfect for NextJS/Express apps that need to queue tasks
 */
export class CleoClient {
  private static instances: Map<string, CleoClient> = new Map();
  protected queueManager: QueueManager | null = null;
  private isConfigured = false;
  private readonly instanceId: RedisInstance;
  private isClientMode = true;

  constructor(instanceId: RedisInstance = RedisInstance.DEFAULT) {
    this.instanceId = instanceId;
  }

  static getInstance(instanceId: RedisInstance = RedisInstance.DEFAULT): CleoClient {
    if (!CleoClient.instances.has(instanceId)) {
      logger.info(
        "File: client-mode.ts 🔄, Line: 22, Function: getInstance; Creating new CleoClient instance",
        { instanceId }
      );
      CleoClient.instances.set(instanceId, new CleoClient(instanceId));
    }
    return CleoClient.instances.get(instanceId)!;
  }

  async configure(config: {
    redis: {
      host: string;
      port: number;
      password?: string;
      tls?: boolean;
      db?: number;
    };
    // No worker config in client mode
  }): Promise<void> {
    try {
      logger.info(
        "File: client-mode.ts ⚙️, Line: 36, Function: configure; Configuring CleoClient instance",
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
        "File: client-mode.ts 🔌, Line: 43, Function: configure; Redis configuration",
        { redisConfig }
      );

      // Initialize Redis connection for this instance
      redisConnection.initializeInstance(this.instanceId, redisConfig);

      // Create QueueManager without workers
      this.queueManager = new QueueManager(
        "default",
        this.instanceId,
        {},
        undefined, // No worker config in client mode
        false // Don't create workers in client mode
      );

      // Initialize task decorator with this instance
      const { initializeTaskDecorator } = await import("../decorators/task");
      initializeTaskDecorator(this);

      this.isConfigured = true;
      logger.info(
        "File: client-mode.ts ✅, Line: 56, Function: configure; CleoClient configuration complete",
        { instanceId: this.instanceId }
      );
    } catch (error) {
      logger.error(
        "File: client-mode.ts ❌, Line: 58, Function: configure; Configuration failed",
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
        "File: client-mode.ts ⚠️, Line: 85, Function: getQueueManager; CleoClient must be configured before using"
      );
      throw new Error("CleoClient must be configured before using");
    }
    return this.queueManager!;
  }

  /**
   * Override getWorker to throw error in client mode
   */
  getWorker(queueName: string): never {
    throw new Error(
      "Workers are not available in client mode. Use a separate worker process to process jobs."
    );
  }

  /**
   * Override getWorkerManager to throw error in client mode
   */
  getWorkerManager(): never {
    throw new Error(
      "WorkerManager is not available in client mode. Use a separate worker process to process jobs."
    );
  }

  /**
   * Check if running in client mode
   */
  isClientModeEnabled(): boolean {
    return this.isClientMode;
  }

  /**
   * Schedule a task without processing it
   */
  async scheduleTask(
    name: string,
    data: any,
    options: any = {}
  ): Promise<any> {
    if (!this.isConfigured) {
      throw new Error("CleoClient must be configured before scheduling tasks");
    }

    const queueManager = this.getQueueManager();
    return await queueManager.addTask(name, data, options);
  }

  /**
   * Schedule a task to a group
   */
  async scheduleGroupTask(
    methodName: string,
    taskOptions: any,
    taskData: any
  ): Promise<void> {
    if (!this.isConfigured) {
      throw new Error("CleoClient must be configured before scheduling group tasks");
    }

    const queueManager = this.getQueueManager();
    return await queueManager.addTaskToGroup(methodName, taskOptions, taskData);
  }

  /**
   * Get the task decorator for this instance
   */
  get task() {
    const { task } = require("../decorators/task");
    return task;
  }
}