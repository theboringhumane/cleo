import { QueueManager } from "../queue/queueManager";
import { Worker } from "../workers";
import { logger } from "../utils/logger";
import { WorkerConfig } from "../types/interfaces";
import { RedisInstance } from "../config/redis";
import { redisConnection } from "../config/redis";

/**
 * Worker mode for Cleo - processes jobs from Redis queues
 * Perfect for Bun background processes that consume and process tasks
 */
export class CleoWorker {
  private static instances: Map<string, CleoWorker> = new Map();
  protected queueManager: QueueManager | null = null;
  private isConfigured = false;
  private readonly instanceId: RedisInstance;
  private isWorkerMode = true;
  private workers: Map<string, Worker> = new Map();

  constructor(instanceId: RedisInstance = RedisInstance.DEFAULT) {
    this.instanceId = instanceId;
  }

  static getInstance(instanceId: RedisInstance = RedisInstance.DEFAULT): CleoWorker {
    if (!CleoWorker.instances.has(instanceId)) {
      logger.info(
        "File: worker-mode.ts 🔄, Line: 15, Function: getInstance; Creating new CleoWorker instance",
        { instanceId }
      );
      CleoWorker.instances.set(instanceId, new CleoWorker(instanceId));
    }
    return CleoWorker.instances.get(instanceId)!;
  }

  async configure(config: {
    redis: {
      host: string;
      port: number;
      password?: string;
      tls?: boolean;
      db?: number;
    };
    worker?: WorkerConfig;
  }): Promise<void> {
    try {
      logger.info(
        "File: worker-mode.ts ⚙️, Line: 25, Function: configure; Configuring CleoWorker instance",
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
        "File: worker-mode.ts 🔌, Line: 43, Function: configure; Redis configuration",
        { redisConfig }
      );

      // Initialize Redis connection for this instance
      redisConnection.initializeInstance(this.instanceId, redisConfig);

      // Create QueueManager with workers
      this.queueManager = new QueueManager(
        "default",
        this.instanceId,
        {},
        config.worker,
        true // Create workers in worker mode
      );

      // Initialize task decorator with this instance
      const { initializeTaskDecorator } = await import("../decorators/task");
      initializeTaskDecorator(this);

      this.isConfigured = true;
      logger.info(
        "File: worker-mode.ts ✅, Line: 56, Function: configure; CleoWorker configuration complete",
        { instanceId: this.instanceId }
      );
    } catch (error) {
      logger.error(
        "File: worker-mode.ts ❌, Line: 58, Function: configure; Configuration failed",
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
        "File: worker-mode.ts ⚠️, Line: 85, Function: getQueueManager; CleoWorker must be configured before using"
      );
      throw new Error("CleoWorker must be configured before using");
    }
    return this.queueManager!;
  }

  /**
   * Register a task handler for processing
   */
  registerTaskHandler(
    taskName: string,
    handler: Function,
    queueName: string = "default"
  ): void {
    if (!this.isConfigured) {
      throw new Error("CleoWorker must be configured before registering task handlers");
    }

    const queueManager = this.getQueueManager();
    const worker = queueManager.getWorker(queueName);
    
    if (!worker) {
      throw new Error(`No worker found for queue ${queueName}`);
    }

    worker.registerTask(taskName, handler);
    
    logger.info("🎯 CleoWorker: Task handler registered", {
      file: "worker-mode.ts",
      function: "registerTaskHandler",
      taskName,
      queueName,
    });
  }

  /**
   * Register multiple task handlers at once
   */
  registerTaskHandlers(handlers: {
    [taskName: string]: {
      handler: Function;
      queueName?: string;
    };
  }): void {
    Object.entries(handlers).forEach(([taskName, { handler, queueName = "default" }]) => {
      this.registerTaskHandler(taskName, handler, queueName);
    });
  }

  /**
   * Start processing jobs from all queues
   */
  async startProcessing(): Promise<void> {
    if (!this.isConfigured) {
      throw new Error("CleoWorker must be configured before starting processing");
    }

    const queueManager = this.getQueueManager();
    const allWorkers = await queueManager.getAllWorkers();
    
    logger.info("🚀 CleoWorker: Starting job processing", {
      file: "worker-mode.ts",
      function: "startProcessing",
      workerCount: allWorkers.length,
    });

    // Workers are automatically started when created
    // This method can be used for additional setup if needed
  }

  /**
   * Stop processing jobs
   */
  async stopProcessing(): Promise<void> {
    const queueManager = this.getQueueManager();
    
    // Close all workers
    for (const [queueName, worker] of this.workers) {
      await worker.close();
      logger.info("🛑 CleoWorker: Worker stopped", {
        file: "worker-mode.ts",
        function: "stopProcessing",
        queueName,
      });
    }

    this.workers.clear();
    
    logger.info("🛑 CleoWorker: All workers stopped", {
      file: "worker-mode.ts",
      function: "stopProcessing",
    });
  }

  /**
   * Get worker status
   */
  async getWorkerStatus(queueName: string = "default"): Promise<any> {
    const queueManager = this.getQueueManager();
    const worker = queueManager.getWorker(queueName);
    
    if (!worker) {
      return null;
    }

    return {
      id: worker.workerId,
      queue: worker.queue,
      status: await worker.getStatus(),
      activeTasks: await worker.getActiveTasks(),
      metrics: await worker.getMetrics(),
    };
  }

  /**
   * Get all workers status
   */
  async getAllWorkersStatus(): Promise<any[]> {
    const queueManager = this.getQueueManager();
    const allWorkers = await queueManager.getAllWorkers();
    
    const statuses = await Promise.all(
      allWorkers.map(async (workerId) => {
        const worker = await queueManager.getWorkerById(workerId);
        if (!worker) return null;
        
        return {
          id: worker.workerId,
          queue: worker.queue,
          status: await worker.getStatus(),
          activeTasks: await worker.getActiveTasks(),
          metrics: await worker.getMetrics(),
        };
      })
    );

    return statuses.filter(Boolean);
  }

  /**
   * Check if running in worker mode
   */
  isWorkerModeEnabled(): boolean {
    return this.isWorkerMode;
  }
}