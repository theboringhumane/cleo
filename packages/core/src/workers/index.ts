import { Worker as BullWorker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import {
  WorkerConfig,
  WorkerMetrics,
} from "../types/interfaces";
import { ObserverEvent, TaskStatus } from "../types/enums";
import { TaskObserver } from "../observers/taskObserver";
import { logger } from "../utils/logger";
import {
  WORKERS_SET_KEY,
  WORKER_KEY,
  TASK_HISTORY_KEY,
} from "../constants";
import { QueueManager } from "../queue/queueManager";
import type { Redis } from "ioredis";
import { MonkeyCapture } from "../decorators/monkeyLog";
import { TaskHistoryService } from "../services/taskHistory";

export class Worker extends BullWorker {
  private registeredTasks: Map<string, Function> = new Map();
  private observer: TaskObserver;
  private queueManager: QueueManager | null = null;
  private _workerId: string;
  private _queueName: string;
  private redis: Redis;
  private metricsKey: string;
  private activeTasksKey: string;
  private statusKey: string;
  private lastHeartbeatKey: string;
  private taskHistoryKey: string;
  public workersKey: string;
  private taskHistoryService: TaskHistoryService;
  private instanceId: string;

  constructor(
    queueName: string,
    config: WorkerConfig = {},
    instanceId: string = "default"
  ) {
    const redis = redisConnection.getInstance(instanceId);
    super(
      queueName,
      async (job: Job) => {
        await this.JobProcessor(job);
      },
      {
        connection: redis,
        ...config,
        // Add stalling detection
        stalledInterval: 30000, // Check for stalled jobs every 30 seconds
        maxStalledCount: 2, // Consider job stalled after 2 checks
      }
    );

    this.instanceId = instanceId;

    this.redis = redis;
    this.observer = new TaskObserver(redis);
    this.setObservers(this.observer);

    this._workerId = this.id;
    this._queueName = queueName;

    // Initialize Redis keys
    this.workersKey = WORKERS_SET_KEY;
    this.metricsKey = `${WORKER_KEY}:${this._workerId}:metrics`;
    this.activeTasksKey = `${WORKER_KEY}:${this._workerId}:activeTasks`;
    this.statusKey = `${WORKER_KEY}:${this._workerId}:status`;
    this.lastHeartbeatKey = `${WORKER_KEY}:${this._workerId}:lastHeartbeat`;
    this.taskHistoryKey = `${TASK_HISTORY_KEY}${this._workerId}`;

    // Initialize workers in Redis
    this.initializeWorkers();

    // Initialize metrics in Redis
    this.initializeMetrics();

    // Start heartbeat
    this.startHeartbeat();

    this.taskHistoryService = TaskHistoryService.getInstance(instanceId as any);

    logger.info("🔧 Worker: initialized", {
      file: "worker.ts",
      function: "constructor",
      workerId: this._workerId,
      queueName: this._queueName,
      taskHistoryKey: this.taskHistoryKey,
    });
  }

  private async JobProcessor(job: Job): Promise<any> {
    const startTime = Date.now();
    const group = job.data.options?.group;

    // Track active task
    await this.addActiveTask(job.id!, job.name);

    try {
      const handler = this.registeredTasks.get(job.name);
      if (!handler) {
        throw new Error(`No handler registered for task ${job.name}`);
      }

      logger.debug("🚀 Worker: Processing task", {
        file: "worker/index.ts",
        function: "processor",
        jobId: job.id,
        name: job.name,
        group: group,
        data: job.data.args ?? job.data,
      });

      let data = job.data.args ?? job.data;
      if (data.hasOwnProperty("data")) {
        data = data.data;
      }

      // Remove the options wrapper if it exists
      if (data.hasOwnProperty("options")) {
        const { options, ...taskData } = data;
        data = taskData;
      }

      // If there's only one property that's not options, use its value
      const dataKeys = Object.keys(data).filter(key => key !== "options");
      if (dataKeys.length === 1) {
        data = data[dataKeys[0]];
      }

      await job.updateProgress(0);

      const timeout = job.data.options?.timeout || 300000;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Task ${job.name} timed out after ${timeout}ms`));
        }, timeout);
      });

      const result = await Promise.race([
        MonkeyCapture(handler)(job, this._workerId, this.instanceId, ...data),
        timeoutPromise,
      ]);

      await job.updateProgress(100);

      // Update metrics and history
      const duration = Date.now() - startTime;
      await this.updateMetrics(true, duration);
      await this.addTaskHistory(
        job.id!,
        "completed",
        duration,
        undefined,
        group
      );
      await this.removeActiveTask(job.id!);

      // Handle group task completion
      if (group && this.queueManager) {
        await this.queueManager.completeGroupTask(job.id!, group);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.updateMetrics(false, duration);
      await this.addTaskHistory(job.id!, "failed", duration, error, group);
      await this.removeActiveTask(job.id!);

      // Handle group task failure
      if (group && this.queueManager) {
        const taskGroup = await this.queueManager.getGroup(group);
        await taskGroup.failTask(job.id!, error as Error);
      }

      const retryCount = job.attemptsMade;
      const maxRetries = job.opts.attempts || 3;

      logger.error("❌ Worker: Task processing failed", {
        file: "worker/index.ts",
        function: "processor",
        jobId: job.id,
        error,
        attempt: retryCount,
        maxRetries,
        group,
      });

      if (retryCount < maxRetries) {
        const backoffOpts = job.opts.backoff;
        const backoffDelay =
          typeof backoffOpts === "number"
            ? backoffOpts
            : backoffOpts?.delay || 1000;
        const nextDelay = backoffDelay * Math.pow(2, retryCount - 1);

        logger.info("🔄 Worker: Retrying task", {
          file: "worker/index.ts",
          function: "processor",
          jobId: job.id,
          nextAttempt: retryCount + 1,
          delay: nextDelay,
          group,
        });

        throw error;
      }

      if (this.queueManager?.deadLetterQueue) {
        await this.queueManager.deadLetterQueue.addFailedTask(
          job.data,
          error as Error,
          job.queueName
        );

        logger.warn("⚠️ Worker: Task moved to dead letter queue", {
          file: "worker/index.ts",
          function: "processor",
          jobId: job.id,
          group,
        });
      }

      throw error;
    }
  }

  private async initializeWorkers(): Promise<void> {
    await this.redis.sadd(this.workersKey, this._workerId);
    await this.redis.set(
      this.statusKey,
      this.isRunning() ? "active" : "paused"
    );
  }

  private async initializeMetrics(): Promise<void> {
    const exists = await this.redis.exists(this.metricsKey);
    if (!exists) {
      await this.redis.hmset(this.metricsKey, {
        tasksProcessed: 0,
        tasksSucceeded: 0,
        tasksFailed: 0,
        totalProcessingTime: 0,
      });
    }
  }

  private startHeartbeat(): void {
    setInterval(async () => {
      if (this.isRunning()) {
        await this.redis.set(this.lastHeartbeatKey, Date.now().toString());
        await this.redis.set(this.statusKey, "active");
      } else {
        await this.redis.set(this.statusKey, "paused");
      }
    }, 5000); // Update every 5 seconds
  }

  private async updateMetrics(
    success: boolean,
    duration: number
  ): Promise<void> {
    const multi = this.redis.multi();
    multi.hincrby(this.metricsKey, "tasksProcessed", 1);
    multi.hincrby(
      this.metricsKey,
      success ? "tasksSucceeded" : "tasksFailed",
      1
    );
    multi.hincrby(this.metricsKey, "totalProcessingTime", duration);

    // Store historical metrics with timestamp
    const timestamp = new Date().toISOString();
    const historyKey = `worker:${this._workerId}:metrics:history`;
    const metrics: WorkerMetrics & { timestamp: string } = {
      timestamp,
      tasksProcessed: parseInt(
        (await this.redis.hget(this.metricsKey, "tasksProcessed")) || "0"
      ),
      tasksSucceeded: parseInt(
        (await this.redis.hget(this.metricsKey, "tasksSucceeded")) || "0"
      ),
      tasksFailed: parseInt(
        (await this.redis.hget(this.metricsKey, "tasksFailed")) || "0"
      ),
      averageProcessingTime: await this.getAverageProcessingTime(),
      totalProcessingTime: parseInt(
        (await this.redis.hget(this.metricsKey, "totalProcessingTime")) || "0"
      ),
    };

    multi.lpush(historyKey, JSON.stringify(metrics));
    multi.ltrim(historyKey, 0, 99); // Keep last 100 entries

    await multi.exec();
  }

  private async addActiveTask(jobId: string, taskName: string): Promise<void> {
    await this.redis.sadd(this.activeTasksKey, `${jobId}:${taskName}`);
  }

  private async removeActiveTask(jobId: string): Promise<void> {
    const members = await this.redis.smembers(this.activeTasksKey);
    const taskToRemove = members.find((member) => member.startsWith(jobId));
    if (taskToRemove) {
      await this.redis.srem(this.activeTasksKey, taskToRemove);
    }
  }

  private async addTaskHistory(
    taskId: string,
    status: string,
    duration: number,
    error?: any,
    group?: string
  ): Promise<void> {
    try {
      await this.taskHistoryService.addTaskHistory(
        taskId,
        status,
        duration,
        this._workerId,
        this._queueName,
        error,
        group
      );
    } catch (error) {
      logger.error("❌ Worker: Failed to add task history", {
        file: "index.ts",
        function: "addTaskHistory",
        workerId: this._workerId,
        taskId,
        error,
      });
    }
  }

  async getTaskHistory(limit: number = 100): Promise<any[]> {
    try {
      return await this.taskHistoryService.getWorkerHistory(this._workerId, limit);
    } catch (error) {
      logger.error("❌ Worker: Failed to get task history", {
        file: "index.ts",
        function: "getTaskHistory",
        workerId: this._workerId,
        error,
      });
      return [];
    }
  }

  async getTaskHistoryById(taskId: string, limit: number = 50): Promise<any[]> {
    try {
      return await this.taskHistoryService.getTaskHistory(taskId, limit);
    } catch (error) {
      logger.error("❌ Worker: Failed to get task history by ID", {
        file: "index.ts",
        function: "getTaskHistoryById",
        workerId: this._workerId,
        taskId,
        error,
      });
      return [];
    }
  }

  async getGlobalTaskHistory(limit: number = 100): Promise<any[]> {
    try {
      return await this.taskHistoryService.getGlobalHistory(limit);
    } catch (error) {
      logger.error("❌ Worker: Failed to get global task history", {
        file: "index.ts",
        function: "getGlobalTaskHistory",
        workerId: this._workerId,
        error,
      });
      return [];
    }
  }

  private async getAverageProcessingTime(): Promise<number> {
    const [totalTime, totalTasks] = await Promise.all([
      this.redis.hget(this.metricsKey, "totalProcessingTime"),
      this.redis.hget(this.metricsKey, "tasksProcessed"),
    ]);
    return parseInt(totalTasks!) > 0
      ? parseInt(totalTime!) / parseInt(totalTasks!)
      : 0;
  }

  async getMetrics(): Promise<WorkerMetrics> {
    const metrics = await this.redis.hgetall(this.metricsKey);
    const tasksProcessed = parseInt(metrics.tasksProcessed || "0");
    const averageProcessingTime =
      tasksProcessed > 0
        ? parseInt(metrics.totalProcessingTime || "0") / tasksProcessed
        : 0;

    return {
      tasksProcessed,
      tasksSucceeded: parseInt(metrics.tasksSucceeded || "0"),
      tasksFailed: parseInt(metrics.tasksFailed || "0"),
      averageProcessingTime,
    };
  }

  async getMetricsHistory(): Promise<
    (WorkerMetrics & { timestamp: string })[]
  > {
    const historyKey = `worker:${this._workerId}:metrics:history`;
    const history = await this.redis.lrange(historyKey, 0, -1);
    return history.map((entry) => JSON.parse(entry));
  }

  async getActiveTasks(): Promise<string[]> {
    return await this.redis.smembers(this.activeTasksKey);
  }

  async getStatus(): Promise<string> {
    if (!this.isRunning()) {
      return "paused";
    }

    const lastHeartbeat = await this.redis.get(this.lastHeartbeatKey);
    if (!lastHeartbeat || Date.now() - parseInt(lastHeartbeat) > 15000) {
      return "inactive";
    }

    return "active";
  }

  setQueueManager(queueManager: QueueManager): void {
    this.queueManager = queueManager;
  }

  getTaskHandler(taskId: string): Function | undefined {
    return this.registeredTasks.get(taskId);
  }

  setObservers(observer: TaskObserver): void {
    this.observer = observer;
    this.on("completed", async (job, result) => {
      if (!job) return;
      const group = job.data?.options?.group;
      this.observer.notify(
        ObserverEvent.TASK_COMPLETED,
        job.id as string,
        TaskStatus.COMPLETED,
        {
          data: {
            group,
            result,
          },
        }
      );
    });

    this.on("failed", (job, error) => {
      if (!job) return;
      const group = job.data?.options?.group;
      this.observer.notify(
        ObserverEvent.TASK_FAILED,
        job.id as string,
        TaskStatus.FAILED,
        {
          data: {
            group,
            error,
          },
        }
      );
    });

    this.on("progress", (job, progress) => {
      if (!job) return;
      const group = job.data?.options?.group;
      this.observer.notify(
        ObserverEvent.TASK_PROGRESS,
        job.id as string,
        TaskStatus.ACTIVE,
        {
          data: {
            group,
            progress,
          },
        }
      );
    });

    this.on("stalled", (jobOrId, result) => {
      const isJobObject = typeof jobOrId === "object" && jobOrId !== null;
      const group = isJobObject
        ? (jobOrId as Job).data?.options?.group
        : undefined;
      const taskId = isJobObject
        ? (jobOrId as Job).id || ""
        : (jobOrId as string) || "";

      if (!taskId) {
        logger.warn("Received stalled event with no task ID");
        return;
      }

      this.observer.notify(
        ObserverEvent.TASK_STALLED,
        taskId,
        TaskStatus.STALLED,
        {
          data: {
            group,
            result,
          },
        }
      );
    });
  }

  registerTask(name: string, handler: Function): void {
    this.registeredTasks.set(name, handler);
  }

  getRegisteredTasks(): string[] {
    return Array.from(this.registeredTasks.keys());
  }

  get queue(): string {
    return this._queueName;
  }

  get workerId(): string {
    return this._workerId;
  }
}
