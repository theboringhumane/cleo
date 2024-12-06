import { task } from "./decorators/task";
import { QueueManager } from "./queue/queueManager";
import { Worker } from "./workers";
import { TaskState, TaskPriority, LogLevel } from "./types/enums";
import type {
  Task,
  TaskOptions,
  WorkerConfig,
  QueueMetrics,
} from "./types/interfaces";
import { logger } from "./utils/logger";
import { redisConnection } from "./config/redis";

// Create a Cleo class to manage configuration
class Cleo {
  private static instance: Cleo;
  protected readonly queueManager: QueueManager;
  protected worker: Worker | null = null;
  private isConfigured = false;

  private constructor() {
    logger.info(
      "File: index.ts 📦, Line: 15, Function: constructor; Initializing Cleo instance"
    );
    this.queueManager = new QueueManager("default");
  }

  static getInstance(): Cleo {
    if (!Cleo.instance) {
      logger.info(
        "File: index.ts 🔄, Line: 22, Function: getInstance; Creating new Cleo instance"
      );
      Cleo.instance = new Cleo();
    }
    return Cleo.instance;
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
        "File: index.ts ⚙️, Line: 36, Function: configure; Configuring Cleo with redis settings",
        {
          host: config.redis.host,
          port: config.redis.port,
        }
      );

      if (!config.redis.host || !config.redis.port) {
        throw new Error("Redis host and port are required");
      }

      process.env.REDIS_HOST = config.redis.host;
      process.env.REDIS_PORT = config.redis.port.toString();

      if (config.redis.password) {
        process.env.REDIS_PASSWORD = config.redis.password;
      }

      if (config.redis.tls) {
        process.env.REDIS_TLS = "true";
      }

      if (config.redis.db) {
        process.env.REDIS_DB = config.redis.db.toString();
      }

      if (config.worker) {
        logger.info(
          "File: index.ts 👷, Line: 51, Function: configure; Initializing worker"
        );
        this.worker = new Worker("default", config.worker);
      }

      this.isConfigured = true;
      logger.info(
        "File: index.ts ✅, Line: 56, Function: configure; Cleo configuration complete"
      );
    } catch (error) {
      logger.error(
        "File: index.ts ❌, Line: 58, Function: configure; Configuration failed",
        { error }
      );
      throw error;
    }
  }

  getQueueManager(): QueueManager {
    if (!this.isConfigured) {
      logger.error(
        "File: index.ts ⚠️, Line: 64, Function: getQueueManager; Cleo must be configured before using"
      );
      throw new Error("Cleo must be configured before using");
    }
    return this.queueManager;
  }

  getWorker(): Worker | null {
    return this.worker;
  }

  // Method decorator
  task = task;
}

// Export a singleton instance
const cleo = Cleo.getInstance();

// Export types and enums
export {
  cleo,
  Task,
  TaskOptions,
  WorkerConfig,
  QueueMetrics,
  TaskState,
  TaskPriority,
  LogLevel,
  redisConnection,
  Worker,
  Cleo,
};
