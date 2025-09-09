import { Queue, QueueOptions, QueueEvents } from "bullmq";
import { Task, TaskOptions, WorkerConfig } from "../types/interfaces";
import {
  TaskState,
  TaskStatus,
  ObserverEvent,
  GroupProcessingStrategy,
} from "../types/enums";
import { logger } from "../utils/logger";
import { redisConnection, RedisInstance } from "../config/redis";
import { TaskObserver, TaskObserverCallback } from "../observers/taskObserver";
import { TaskGroup, GroupConfig } from "../groups/taskGroup";
import { Redis } from "ioredis";
import { Worker } from "../workers";
import { generateUUID } from "../utils";
import { DeadLetterQueue } from "./deadLetterQueue";
import { QueueMetrics } from "./queueMetrics";
import {
  QUEUE_META_PREFIX,
  QUEUE_CONFIG_PREFIX,
  QUEUES_SET_KEY,
  WORKERS_SET_KEY,
  QUEUE_WORKERS_PREFIX,
} from "../constants";

export type WorkerType = Worker;
export type WorkerMap = Map<string, WorkerType>;

export class QueueManager {
  private queues: Map<string, Queue>;
  private queueEvents: Map<string, QueueEvents>;
  private observer: TaskObserver;
  private groups: Map<string, TaskGroup>;
  private redis: Redis;
  private instanceId: RedisInstance;
  private workers: WorkerMap = new Map();
  public deadLetterQueue: DeadLetterQueue;
  private metrics: QueueMetrics;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private shouldCreateWorkers: boolean = true;

  // Redis keys for queue tracking
  private readonly QUEUES_SET_KEY = QUEUES_SET_KEY;
  private readonly QUEUE_META_PREFIX = QUEUE_META_PREFIX;
  private readonly QUEUE_CONFIG_PREFIX = QUEUE_CONFIG_PREFIX;

  constructor(
    defaultQueueName: string = "default",
    redisInstance: RedisInstance = RedisInstance.DEFAULT,
    queueOptions: Partial<QueueOptions> = {},
    workerOptions: WorkerConfig = {},
    createWorkers: boolean = true
  ) {
    this.instanceId = redisInstance;
    this.redis = redisConnection.getInstance(this.instanceId);
    this.queues = new Map();
    this.queueEvents = new Map();
    this.metrics = new QueueMetrics(this.redis);
    this.shouldCreateWorkers = createWorkers;

    const finalQueueOptions: QueueOptions = {
      connection: this.redis.options,
      ...queueOptions,
    };

    this.initializeQueue(
      defaultQueueName,
      finalQueueOptions,
      workerOptions,
      this.instanceId,
      createWorkers
    );
    this.observer = new TaskObserver(this.redis);
    this.groups = new Map();
    this.deadLetterQueue = new DeadLetterQueue(
      {
        maxRetries: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        alertThreshold: 10,
      },
      this.instanceId
    );

    // Initialize task observers
    this.setupTaskObservers();

    // Setup queue metrics collection
    this.startQueueMetricsCollection();
    this.startHealthCheck();
  }

  // Get all queues from Redis
  async getQueues(): Promise<string[]> {
    return await this.redis.smembers(this.QUEUES_SET_KEY);
  }

  // Get queue metadata from Redis
  async getQueueMetadata(queueName: string): Promise<any> {
    const metadata = await this.redis.hgetall(
      `${this.QUEUE_META_PREFIX}${queueName}`
    );
    return metadata
      ? {
          ...metadata,
          createdAt: new Date(parseInt(metadata.createdAt)),
          lastActivity: new Date(parseInt(metadata.lastActivity)),
        }
      : null;
  }

  // Update queue metadata in Redis
  private async updateQueueMetadata(
    queueName: string,
    metadata: any = {}
  ): Promise<void> {
    const key = `${this.QUEUE_META_PREFIX}${queueName}`;
    const now = Date.now();

    await this.redis.hmset(key, {
      ...metadata,
      lastActivity: now,
    });
  }

  // Store queue configuration in Redis
  private async storeQueueConfig(
    queueName: string,
    config: QueueOptions
  ): Promise<void> {
    const key = `${this.QUEUE_CONFIG_PREFIX}${queueName}`;
    await this.redis.hmset(key, {
      ...config,
      connection: JSON.stringify(config.connection),
    });
  }

  // Get queue configuration from Redis
  private async getQueueConfig(
    queueName: string
  ): Promise<QueueOptions | null> {
    const key = `${this.QUEUE_CONFIG_PREFIX}${queueName}`;
    const config = await this.redis.hgetall(key);
    if (!config || Object.keys(config).length === 0) return null;

    return {
      ...config,
      connection: JSON.parse(config.connection),
    };
  }

  private async initializeQueue(
    queueName: string,
    queueOptions: QueueOptions,
    workerOptions: WorkerConfig = {},
    instanceId: string = "default",
    createWorkers: boolean = true
  ): Promise<void> {
    // Add queue to Redis set
    await this.redis.sadd(this.QUEUES_SET_KEY, queueName);

    // Store queue metadata
    await this.updateQueueMetadata(queueName, {
      createdAt: Date.now(),
      instanceId,
    });

    // Store queue configuration
    await this.storeQueueConfig(queueName, queueOptions);

    const queue = new Queue(queueName, queueOptions);
    this.queues.set(queueName, queue);

    // Initialize queue events
    const queueEvents = new QueueEvents(queueName, {
      connection: queueOptions.connection,
    });

    queueEvents.on("completed", async ({ jobId, returnvalue }) => {
      await this.updateQueueMetadata(queueName, {
        lastActivity: Date.now(),
      });
      logger.info("✅ QueueManager: Job completed", {
        file: "queueManager.ts",
        function: "queueEvents",
        queue: queueName,
        jobId,
        result: returnvalue,
      });
    });

    queueEvents.on("failed", async ({ jobId, failedReason }) => {
      await this.updateQueueMetadata(queueName);
      logger.error("❌ QueueManager: Job failed", {
        file: "queueManager.ts",
        function: "queueEvents",
        queue: queueName,
        jobId,
        error: failedReason,
      });
    });

    queueEvents.on("stalled", async ({ jobId }) => {
      await this.updateQueueMetadata(queueName);
      logger.warn("⚠️ QueueManager: Job stalled", {
        file: "queueManager.ts",
        function: "queueEvents",
        queue: queueName,
        jobId,
      });
    });

    queueEvents.on("progress", async ({ jobId, data }) => {
      await this.updateQueueMetadata(queueName);
      logger.debug("📈 QueueManager: Job progress", {
        file: "queueManager.ts",
        function: "queueEvents",
        queue: queueName,
        jobId,
        progress: data,
      });
    });

    this.queueEvents.set(queueName, queueEvents);
    
    // Only create workers if requested
    if (createWorkers) {
      this.initializeWorker(queueName, workerOptions, instanceId);
    }
  }

  initializeWorker(
    queueName: string,
    workerOptions: WorkerConfig = {},
    instanceId: string = "default"
  ): void {
    const worker = new Worker(queueName, workerOptions, instanceId);
    worker.setQueueManager(this); // Connect worker with QueueManager
    this.workers.set(queueName, worker);
    this.redis.sadd(worker.workersKey, worker.workerId);
    this.redis.sadd(`${QUEUE_WORKERS_PREFIX}${queueName}`, worker.workerId);
  }

  async createQueue(
    queueName: string,
    queueOptions: QueueOptions,
    createWorkers: boolean = true
  ): Promise<Queue> {
    await this.initializeQueue(queueName, queueOptions, {}, this.instanceId, createWorkers && this.shouldCreateWorkers);
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Failed to create queue ${queueName}`);
    }
    return queue;
  }

  async getQueue(queueName: string): Promise<Queue | null> {
    const queue = this.queues.get(queueName);

    if (!queue) {
      // Try to restore queue from Redis
      const config = await this.getQueueConfig(queueName);
      if (config) {
        await this.initializeQueue(queueName, config, {}, this.instanceId, this.shouldCreateWorkers);
        return this.queues.get(queueName) || null;
      }
    }

    return queue || null;
  }

  async getQueueMetrics(queueName: string) {
    logger.info("📊 QueueManager: Getting queue metrics", {
      file: "queueManager.ts",
      function: "getQueueMetrics",
      queueName,
    });
    return this.metrics.getMetrics(queueName);
  }

  async getLatestQueueMetrics(queueName: string) {
    return this.metrics.getLatestMetrics(queueName);
  }

  async getAllQueueMetrics() {
    return this.metrics.getAllQueueMetrics();
  }

  async getAllWorkers() {
    return await this.redis.smembers(WORKERS_SET_KEY);
  }

  async getQueueWorkers(queueName: string) {
    return await this.redis.smembers(`${QUEUE_WORKERS_PREFIX}${queueName}`);
  }

  async getWorkerById(workerId: string): Promise<WorkerType | undefined> {
    const worker = await this.redis.sismember(WORKERS_SET_KEY, workerId);
    if (worker) {
      // Find worker by ID across all queue workers
      for (const [queueName, queueWorker] of this.workers) {
        if (queueWorker.workerId === workerId) {
          return queueWorker;
        }
      }
    }
    return undefined;
  }

  getWorker(queueNameOrId: string = "default"): WorkerType | undefined {
    // If not found by ID, try to find by queue name
    return this.workers.get(queueNameOrId) as WorkerType | undefined;
  }

  private async startQueueMetricsCollection() {
    // Collect metrics every minute
    setInterval(async () => {
      for (const [queueName, queue] of this.queues) {
        try {
          const counts = await queue.getJobCounts();
          const waitingTime = await this.getAverageWaitingTime(queue);

          const metricsData = {
            waiting: counts.waiting || 0,
            active: counts.active || 0,
            completed: counts.completed || 0,
            failed: counts.failed || 0,
            delayed: counts.delayed || 0,
            paused: counts.paused || 0,
            averageWaitingTime: waitingTime,
            timestamp: Date.now(),
          };

          // Save metrics to Redis
          await this.metrics.saveMetrics(queueName, metricsData);

          logger.info("📊 QueueManager: Queue metrics", {
            file: "queueManager.ts",
            function: "collectMetrics",
            queue: queueName,
            metrics: metricsData,
          });
        } catch (error) {
          logger.error("❌ QueueManager: Failed to collect metrics", {
            file: "queueManager.ts",
            function: "collectMetrics",
            queue: queueName,
            error,
          });
        }
      }
    }, 60000);
  }

  private async getAverageWaitingTime(queue: Queue): Promise<number> {
    try {
      const jobs = await queue.getJobs(["waiting"], 0, 10);
      if (jobs.length === 0) return 0;

      const waitingTimes = jobs.map((job) => {
        const createdAt = job.timestamp;
        return Date.now() - createdAt;
      });

      return waitingTimes.reduce((a, b) => a + b, 0) / waitingTimes.length;
    } catch (error) {
      logger.error("❌ QueueManager: Failed to calculate waiting time", {
        file: "queueManager.ts",
        function: "getAverageWaitingTime",
        error,
      });
      return 0;
    }
  }

  async addTask(
    name: string,
    data: any,
    options: TaskOptions = {}
  ): Promise<Task> {
    const queueName = options.queue || "default";
    let queue = this.queues.get(queueName);

    if (!queue) {
      this.initializeQueue(queueName, {
        connection: this.redis.options,
      });
      queue = this.queues.get(queueName);
    }

    const task: Task = {
      id: options.id ?? `${name}-${generateUUID()}`,
      name,
      data,
      options,
      state: TaskState.WAITING,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const jobOptions = {
      id: task.id,
      priority: options.priority,
      attempts: options.maxRetries,
      backoff: {
        type: "exponential",
        delay: options.retryDelay || 3000,
      },
      timeout: options.timeout || 300000, // 5 minutes
      removeOnComplete: options.removeOnComplete || false,
      repeat: options.schedule,
      jobId: task.id,
    };

    const job = jobOptions.repeat?.pattern
      ? await queue!.upsertJobScheduler(jobOptions.id, jobOptions.repeat, {
          name,
          data,
          opts: jobOptions,
        })
      : await queue!.add(name, data, jobOptions);

    this.observer.notify(
      ObserverEvent.TASK_ADDED,
      task.id,
      TaskStatus.WAITING,
      task
    );

    await this.updateQueueMetadata(queueName);

    logger.debug("🔄 QueueManager: Task added to queue", {
      file: "queueManager.ts",
      line: 120,
      function: "addTask",
      taskId: job.id,
      queueName,
    });

    return {
      ...task,
      state: (await job.getState()) as TaskState,
      id: job.id!,
    };
  }

  async getTask(
    taskId: string,
    queueName: string = "default"
  ): Promise<Task | null> {
    if (!taskId) {
      logger.error("❌ QueueManager: Task ID is required", {
        file: "queueManager.ts",
        line: 186,
        function: "getTask",
        queueName,
      });
      return null;
    }

    const queue = this.queues.get(queueName);
    if (!queue) {
      logger.error("❌ QueueManager: Queue not found", {
        file: "queueManager.ts",
        line: 150,
        function: "getTask",
        queueName,
      });
      return null;
    }

    const job = await queue.getJob(taskId);
    if (!job) {
      return null;
    }

    return {
      options: {
        ...job.opts,
        queue: queueName,
      },
      data: job.data,
      state: (await job.getState()) as TaskState,
      queue: queueName,
      name: job.name,
      id: job.id,
      createdAt: job.timestamp,
      updatedAt: new Date(),
    } as unknown as Task;
  }

  async getAllTasks(): Promise<Task[]> {
    const allTasks = await Promise.all(
      Array.from(this.queues.values()).map(async (queue) => queue.getJobs())
    );
    return allTasks.flat().map((job) => job.data as Task);
  }

  async removeTask(
    taskId: string,
    queueName: string = "default"
  ): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) return false;

    const job = await queue.getJob(taskId);
    if (!job) return false;

    if (job.opts.repeat) {
      await queue.removeJobScheduler(job.id || job.name);
    } else {
      await job.remove();
    }

    return true;
  }

  async getQueueTasks(queueName: string): Promise<Task[]> {
    const queue = this.queues.get(queueName);
    if (!queue) return [];

    const jobs = await queue.getJobs();
    return jobs.map((job) => job.data as Task);
  }

  // Simplified group methods
  async getGroup(groupName: string): Promise<TaskGroup> {
    let group = this.groups.get(groupName);

    if (!group) {
      const config: GroupConfig = {
        name: groupName,
        priority: await this.getGroupPriority(groupName),
        concurrency: 1,
        maxConcurrency: 10,
        strategy: GroupProcessingStrategy.FIFO,
        retryDelay: 3000,
        retryLimit: 3,
        timeout: 300000,
      };

      group = new TaskGroup(this.redis, config);
      group.connect(this, this.workers.get(config.name) as Worker);
      this.groups.set(groupName, group);
    }

    return group;
  }

  async addTaskToGroup(
    methodName: string,
    taskOptions: TaskOptions,
    taskData: any
  ): Promise<void> {
    const { group: groupName } = taskOptions;
    if (!groupName) {
      throw new Error("Group name is required for group tasks");
    }

    const group = await this.getGroup(groupName);
    await group.addTask(methodName, taskOptions, taskData);
    await group.startProcessing();
  }

  async ensureTaskInQueue(task: Task, queueName: string): Promise<void> {
    const queue = await this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const existingJob = await queue.getJob(task.id);
    if (!existingJob) {
      await queue.add(task.name, task.data, {
        jobId: task.id,
        ...task.options,
      });
    }
  }

  async completeGroupTask(taskId: string, groupName: string): Promise<void> {
    const group = await this.getGroup(groupName);
    await group.completeTask(taskId);
  }

  async getAllGroups(): Promise<string[]> {
    const keys = await this.redis.keys("group:*:tasks");
    return keys.map((key) => key.split(":")[1]);
  }

  // Event handling methods
  onTaskEvent(event: ObserverEvent, callback: TaskObserverCallback): void {
    this.observer.subscribe(event, callback);
  }

  offTaskEvent(event: ObserverEvent): void {
    this.observer.unsubscribe(event);
  }

  private setupTaskObservers(): void {
    // Listen for task additions to groups
    this.observer.subscribe(
      ObserverEvent.TASK_ADDED,
      async (taskId, status, data) => {
        if (data?.options?.group) {
          const group = await this.getGroup(data.options.group);
          await group.startProcessing();
        }
      }
    );

    // Listen for task completions
    this.observer.subscribe(
      ObserverEvent.TASK_COMPLETED,
      async (taskId, status, data) => {
        const groupName = data?.options?.group ?? data?.group;
        if (groupName) {
          const group = await this.getGroup(groupName);
          await group.completeTask(taskId);
        }
      }
    );

    // Listen for task failures
    this.observer.subscribe(
      ObserverEvent.TASK_FAILED,
      async (taskId, status, data) => {
        const groupName = data?.options?.group ?? data?.group;
        if (groupName) {
          logger.error("❌ QueueManager: Task failed in group", {
            file: "queueManager.ts",
            function: "setupTaskObservers",
            taskId,
            group: groupName,
            error: data.error,
          });
        }
      }
    );

    // Listen for task progress
    this.observer.subscribe(
      ObserverEvent.TASK_PROGRESS,
      (taskId, status, data) => {
        logger.debug("📊 QueueManager: Task progress update", {
          file: "queueManager.ts",
          function: "setupTaskObservers",
          taskId,
          progress: data.progress,
        });
      }
    );
  }

  async updateTask(task: Task): Promise<void> {
    const queueName = task.options.queue || "default";
    const queue = await this.getQueue(queueName);

    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.getJob(task.id);
    if (!job) {
      throw new Error(`Task ${task.id} not found`);
    }

    // Update task data
    await job.updateData({
      ...task,
      updatedAt: new Date(),
    });

    // Notify observers about the update
    this.observer.notify(
      ObserverEvent.STATUS_CHANGE,
      task.id,
      task.state as unknown as TaskStatus,
      task
    );
  }

  async close(): Promise<void> {
    await this.observer.close();
    await Promise.all(
      Array.from(this.queues.values()).map((queue) => queue.close())
    );
    await Promise.all(
      Array.from(this.queueEvents.values()).map((events) => events.close())
    );
    await this.deadLetterQueue.close();
  }

  startHealthCheck(interval: number = 60000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        // Check all active groups
        for (const groupName of this.groups.keys()) {
          const group = await this.getGroup(groupName);
          await group.recoverStuckTasks();
        }

        // Clean up inactive groups
        const allGroups = await this.getAllGroups();
        for (const groupName of allGroups) {
          const group = await this.getGroup(groupName);
          const hasActiveTasks = await group.hasAvailableTasks();
          if (!hasActiveTasks) {
            this.groups.delete(groupName);
          }
        }
      } catch (error) {
        logger.error("❌ QueueManager: Health check failed", {
          file: "queueManager.ts",
          function: "healthCheck",
          error,
        });
      }
    }, interval);
  }

  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private async getGroupPriority(groupName: string): Promise<number> {
    const priority = await this.redis.hget("group:priorities", groupName);
    return priority ? parseInt(priority) : 0;
  }

  async setGroupPriority(groupName: string, priority: number): Promise<void> {
    await this.redis.hset("group:priorities", groupName, priority.toString());
    const group = await this.getGroup(groupName);
    await group.updateConfig({ priority });
  }
}
