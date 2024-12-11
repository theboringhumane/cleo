import { Queue, JobsOptions, QueueOptions } from "bullmq";
import { Task, TaskOptions, WorkerConfig } from "../types/interfaces";
import { TaskState, TaskStatus, ObserverEvent, GroupOperation, GroupProcessingStrategy } from "../types/enums";
import { logger } from "../utils/logger";
import { redisConnection, RedisInstance } from "../config/redis";
import { TaskObserver, TaskObserverCallback } from '../observers/taskObserver';
import { TaskGroup } from '../groups/taskGroup';
import { Redis } from "ioredis";
import { Worker } from "../workers";

interface GroupInfo {
  name: string;
  priority: number;
  lastProcessed?: number;
}

export class QueueManager {
  private queues: Map<string, Queue>;
  private observer: TaskObserver;
  private groups: Map<string, TaskGroup>;
  private groupProcessingStrategy: GroupProcessingStrategy = GroupProcessingStrategy.ROUND_ROBIN;
  private redis: Redis;
  private instanceId: RedisInstance;
  private workers: Map<string, Worker> = new Map();
  private isProcessing: boolean = false;
  private activeGroups: Set<string> = new Set();
  private groupOrderKey = 'queue:group:processing-order';
  private groupInfos: Map<string, GroupInfo> = new Map();

  constructor(
    defaultQueueName: string = 'default',
    redisInstance: RedisInstance = RedisInstance.DEFAULT,
    queueOptions: QueueOptions = {},
    workerOptions: WorkerConfig = {}
  ) {
    this.instanceId = redisInstance;
    this.redis = redisConnection.getInstance(this.instanceId);
    this.queues = new Map();
    queueOptions.connection = this.redis;
    this.initializeQueue(defaultQueueName, queueOptions, workerOptions, this.instanceId);
    this.observer = new TaskObserver(this.redis);
    this.groups = new Map();
    
    // Initialize task observers
    this.setupTaskObservers();
  }

  initializeQueue(
    queueName: string,
    queueOptions: QueueOptions = {},
    workerOptions: WorkerConfig = {},
    instanceId: string = 'default'
  ): void {
    queueOptions.connection = this.redis;
    const queue = new Queue(queueName, queueOptions);
    this.queues.set(queueName, queue);
    this.initializeWorker(queueName, workerOptions, instanceId);
    logger.info("🆕 QueueManager: Queue initialized", {
      file: "queueManager.ts",
      line: 50,
      function: "initializeQueue",
      queueName,
    });
  }

  private initializeWorker(queueName: string, workerOptions: WorkerConfig = {}, instanceId: string = 'default'): void {
    const worker = new Worker(queueName, workerOptions, instanceId);
    worker.setQueueManager(this);  // Connect worker with QueueManager
    this.workers.set(queueName, worker);
  }

  getWorker(queueName: string = 'default'): Worker {
    return this.workers.get(queueName)!;
  }

  getQueue(queueName: string): Queue | null {
    return this.queues.get(queueName) || null;
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
        connection: this.redis,
      });
      queue = this.queues.get(queueName);
    }

    const task: Task = {
      id: options.id || `${name}-${Date.now()}`,
      name,
      data,
      options,
      state: TaskState.WAITING,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // If task belongs to a group, don't add it to the queue yet
    if (options.group) {
      logger.debug("👥 QueueManager: Task belongs to group, deferring queue addition", {
        file: "queueManager.ts",
        line: 90,
        function: "addTask",
        taskId: task.id,
        group: options.group,
      });
      return task;
    }

    const jobOptions: JobsOptions = {
      priority: options.priority,
      attempts: options.maxRetries,
      backoff: {
        type: "exponential",
        delay: options.retryDelay || 3000,
      },
      removeOnComplete: options.removeOnComplete || false,
      repeat: options.schedule ? { pattern: options.schedule.pattern, startDate: options.schedule.startDate, endDate: options.schedule.endDate } : undefined,
    };

    const job = await queue!.add(name, data, jobOptions);

    this.observer.notify(ObserverEvent.TASK_ADDED, task.id, TaskStatus.WAITING, task);
    
    return {
      ...task,
      state: await job.getState() as TaskState,
      id: job.id!,
    };
  }

  async getTask(
    taskId: string,
    queueName: string = "default"
  ): Promise<Task | null> {
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

    return job.data as Task;
  }

  async getAllTasks(): Promise<Task[]> {
    const allTasks = await Promise.all(
      Array.from(this.queues.values()).map(async (queue) => queue.getJobs())
    );
    return allTasks.flat().map((job) => job.data as Task);
  }

  async removeTask(taskId: string, queueName: string = "default"): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) return false;

    const job = await queue.getJob(taskId);
    if (!job) return false;

    await job.remove();
    return true;
  }

  // Group-related methods
  async getGroup(groupName: string): Promise<TaskGroup> {
    if (!this.groups.has(groupName)) {
      this.groups.set(groupName, new TaskGroup(this.redis, groupName));
    }
    return this.groups.get(groupName)!;
  }

  async getGroupTasks(groupName: string): Promise<Task[]> {
    const group = await this.getGroup(groupName);
    const taskIds = await group.getTasks();
    const tasks = await Promise.all(
      taskIds.map(id => this.getTask(id))
    );
    return tasks.filter((task): task is Task => task !== null);
  }

  async addTaskToGroup(taskId: string, groupName: string): Promise<void> {
    const group = await this.getGroup(groupName);
    await group.addTask(taskId);
    
    // Initialize group info if not exists
    if (!this.groupInfos.has(groupName)) {
      this.groupInfos.set(groupName, {
        name: groupName,
        priority: await this.getGroupPriority(groupName),
        lastProcessed: Date.now()
      });
    }
    
    this.activeGroups.add(groupName);
    this.observer.notify(ObserverEvent.GROUP_CHANGE, taskId, TaskStatus.ACTIVE, { 
      group: groupName, 
      operation: GroupOperation.ADD 
    });

    // Add task to queue only if it's next in line for the group
    const nextTaskId = await group.getNextTask();
    if (nextTaskId === taskId) {
      const task = await this.getTask(taskId);
      if (task) {
        const queueName = task.options.queue || "default";
        const queue = this.queues.get(queueName);
        if (queue) {
          const jobOptions: JobsOptions = {
            priority: task.options.priority,
            attempts: task.options.maxRetries,
            backoff: {
              type: "exponential",
              delay: task.options.retryDelay || 3000,
            },
            removeOnComplete: task.options.removeOnComplete || false,
            repeat: task.options.schedule ? { pattern: task.options.schedule.pattern, startDate: task.options.schedule.startDate, endDate: task.options.schedule.endDate } : undefined,
          };

          await queue.add(task.name, task.data, {
            ...jobOptions,
            jobId: task.id, // Ensure job ID matches task ID
          });

          logger.debug("➡️ QueueManager: Added group task to queue", {
            file: "queueManager.ts",
            line: 160,
            function: "addTaskToGroup",
            taskId,
            group: groupName,
          });
        }
      }
    }

    if (!this.isProcessing) {
      this.processGroupTasks().catch(console.error);
    }
  }

  private async getNextGroupByStrategy(): Promise<string | null> {
    const activeGroups = Array.from(this.activeGroups);
    if (activeGroups.length === 0) return null;

    switch (this.groupProcessingStrategy) {
      case GroupProcessingStrategy.ROUND_ROBIN:
        return this.getNextRoundRobinGroup(activeGroups);
      case GroupProcessingStrategy.FIFO:
        return this.getNextFifoGroup(activeGroups);
      case GroupProcessingStrategy.PRIORITY:
        return this.getNextPriorityGroup(activeGroups);
      default:
        return activeGroups[0];
    }
  }

  /**
   * Gets the next task to process based on the current group processing strategy
   * This method is used by tests and external integrations
   */
  async getNextGroupTask(): Promise<Task | null> {
    const nextGroupName = await this.getNextGroupByStrategy();
    if (!nextGroupName) return null;

    const group = await this.getGroup(nextGroupName);
    const taskId = await group.getNextTask();
    
    if (!taskId) {
      this.activeGroups.delete(nextGroupName);
      this.groupInfos.delete(nextGroupName);
      return this.getNextGroupTask(); // Recursively try next group
    }

    const task = await this.getTask(taskId);
    if (task) {
      // Update last processed time
      const groupInfo = this.groupInfos.get(nextGroupName);
      if (groupInfo) {
        groupInfo.lastProcessed = Date.now();
      }
      return task;
    }

    return null;
  }

  private async getNextRoundRobinGroup(activeGroups: string[]): Promise<string | null> {
    // Get the least recently processed group
    const groupInfos = activeGroups.map(name => this.groupInfos.get(name)!);
    const sortedGroups = groupInfos.sort((a, b) => 
      (a.lastProcessed || 0) - (b.lastProcessed || 0)
    );
    
    return sortedGroups[0]?.name || null;
  }

  private async getNextFifoGroup(activeGroups: string[]): Promise<string | null> {
    // Get the group that was added first
    const groupInfos = activeGroups.map(name => this.groupInfos.get(name)!);
    const sortedGroups = groupInfos.sort((a, b) => 
      (a.lastProcessed || 0) - (b.lastProcessed || 0)
    );
    
    return sortedGroups[0]?.name || null;
  }

  private async getNextPriorityGroup(activeGroups: string[]): Promise<string | null> {
    // Get group priorities and sort by highest priority
    const groupInfos = await Promise.all(
      activeGroups.map(async name => ({
        name,
        priority: await this.getGroupPriority(name)
      }))
    );
    
    const sortedGroups = groupInfos.sort((a, b) => b.priority - a.priority);
    return sortedGroups[0]?.name || null;
  }

  async processGroupTasks(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.activeGroups.size > 0) {
        const nextGroupName = await this.getNextGroupByStrategy();
        if (!nextGroupName) {
          this.isProcessing = false;
          return;
        }

        const group = await this.getGroup(nextGroupName);
        const nextTaskId = await group.getNextTask();

        if (nextTaskId) {
          const task = await this.getTask(nextTaskId);
          if (task) {
            await this.processTask(task, nextGroupName);
            // Update last processed time
            const groupInfo = this.groupInfos.get(nextGroupName);
            if (groupInfo) {
              groupInfo.lastProcessed = Date.now();
            }
          }
        } else {
          this.activeGroups.delete(nextGroupName);
          this.groupInfos.delete(nextGroupName);
        }

        // Small delay between tasks to prevent CPU overload
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async getGroupPriority(groupName: string): Promise<number> {
    const priorityKey = `group:${groupName}:priority`;
    const priority = await this.redis.get(priorityKey);
    return priority ? parseInt(priority, 10) : 0;
  }

  async setGroupPriority(groupName: string, priority: number): Promise<void> {
    const priorityKey = `group:${groupName}:priority`;
    await this.redis.set(priorityKey, priority.toString());
    
    // Update in-memory group info
    const groupInfo = this.groupInfos.get(groupName);
    if (groupInfo) {
      groupInfo.priority = priority;
    }

    logger.info("⚡ QueueManager: Group priority updated", {
      file: "queueManager.ts",
      line: 200,
      function: "setGroupPriority",
      groupName,
      priority
    });
  }

  setGroupProcessingStrategy(strategy: GroupProcessingStrategy): void {
    this.groupProcessingStrategy = strategy;
    logger.info("⚙️ QueueManager: Group processing strategy updated", {
      file: "queueManager.ts",
      line: 210,
      function: "setGroupProcessingStrategy",
      strategy
    });
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
    this.observer.subscribe(ObserverEvent.GROUP_CHANGE, (taskId, status, data) => {
      if (data.operation === GroupOperation.ADD) {
        this.activeGroups.add(data.group);
        if (!this.isProcessing) {
          this.processGroupTasks().catch(console.error);
        }
      }
    });

    // Listen for task completions
    this.observer.subscribe(ObserverEvent.TASK_COMPLETED, async (taskId, status, data) => {
      if (data.group) {
        const group = await this.getGroup(data.group);
        const hasMoreTasks = await group.hasAvailableTasks();
        if (!hasMoreTasks) {
          this.activeGroups.delete(data.group);
        }
      }
    });

    // Listen for task failures
    this.observer.subscribe(ObserverEvent.TASK_FAILED, async (taskId, status, data) => {
      if (data.group) {
        logger.error("❌ QueueManager: Task failed in group", {
          file: "queueManager.ts",
          line: 70,
          function: "setupTaskObservers",
          taskId,
          group: data.group,
          error: data.error,
        });
      }
    });

    // Listen for task progress
    this.observer.subscribe(ObserverEvent.TASK_PROGRESS, (taskId, status, data) => {
      logger.debug("📊 QueueManager: Task progress update", {
        file: "queueManager.ts",
        line: 82,
        function: "setupTaskObservers",
        taskId,
        progress: data.progress,
      });
    });
  }

  private async processTask(task: Task, groupName: string): Promise<void> {
    try {
      const worker = this.getWorker(task.options.queue || 'default');
      const handler = worker.getTaskHandler(task.name);

      if (!handler) {
        throw new Error(`No handler found for task ${task.name}`);
      }

      // Process task
      const result = await handler(task.data.args);
      task.result = result;
      task.state = TaskState.COMPLETED;
      await this.updateTask(task);

      // Update group status and notify observers
      const group = await this.getGroup(groupName);
      await group.completeTask(task.id);

      this.observer.notify(ObserverEvent.TASK_COMPLETED, task.id, TaskStatus.COMPLETED, {
        group: groupName,
        result,
      });
    } catch (error) {
      task.state = TaskState.FAILED;
      task.error = error instanceof Error ? error.message : String(error);
      await this.updateTask(task);

      this.observer.notify(ObserverEvent.TASK_FAILED, task.id, TaskStatus.FAILED, {
        group: groupName,
        error: task.error,
      });
    }
  }

  async updateTask(task: Task): Promise<void> {
    const queueName = task.options.queue || "default";
    const queue = this.queues.get(queueName);
    
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
    this.isProcessing = false;
    await this.observer.close();
    await Promise.all(Array.from(this.queues.values()).map(queue => queue.close()));
    this.queues.clear();
  }

  async completeGroupTask(taskId: string, groupName: string): Promise<void> {
    const group = await this.getGroup(groupName);
    await group.completeTask(taskId);

    // Get next task in group and add it to queue
    const nextTaskId = await group.getNextTask();
    if (nextTaskId) {
      const task = await this.getTask(nextTaskId);
      if (task) {
        const queueName = task.options.queue || "default";
        const queue = this.queues.get(queueName);
        if (queue) {
          const jobOptions: JobsOptions = {
            priority: task.options.priority,
            attempts: task.options.maxRetries,
            backoff: {
              type: "exponential",
              delay: task.options.retryDelay || 3000,
            },
            removeOnComplete: task.options.removeOnComplete || false,
            repeat: task.options.schedule ? { pattern: task.options.schedule.pattern, startDate: task.options.schedule.startDate, endDate: task.options.schedule.endDate } : undefined,
          };

          await queue.add(task.name, task.data, {
            ...jobOptions,
            jobId: task.id,
          });

          logger.debug("➡️ QueueManager: Added next group task to queue", {
            file: "queueManager.ts",
            line: 220,
            function: "completeGroupTask",
            taskId: nextTaskId,
            group: groupName,
          });
        }
      }
    } else {
      this.activeGroups.delete(groupName);
      this.groupInfos.delete(groupName);
    }
  }
}

