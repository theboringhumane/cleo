import { redis, generateKeys, redisHelpers, KEYS } from '../redis';
import type { QueueMetrics, Task, TaskOptions } from '@/types/api';

export class QueueService {
  static async getAllQueues() {
    const queues = await redisHelpers.getSetMembers<string>(KEYS.QUEUES_SET);
    
    const queueDetails = await Promise.all(queues.map(async (queueName) => {
      const metrics = await this.getQueueMetrics(queueName);
      const tasks = await this.getQueueTasks(queueName);
      
      return {
        name: queueName,
        metrics,
        tasks,
      };
    }));
    
    return queueDetails;
  }

  static async getQueueByName(queueName: string) {
    const metrics = await this.getQueueMetrics(queueName);
    const tasks = await this.getQueueTasks(queueName);
    
    return {
      metrics,
      tasks,
    };
  }

  static async getQueueMetrics(queueName: string): Promise<QueueMetrics> {
    const metricsKey = generateKeys.metricsKey('queue', queueName);
    const metrics = await redisHelpers.getHashAsObject<QueueMetrics>(metricsKey);
    
    return metrics || {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
      averageWaitingTime: 0,
      timestamp: Date.now(),
    };
  }

  static async getQueueTasks(queueName: string): Promise<Task[]> {
    const queueKey = generateKeys.queueKey(queueName);
    const taskIds = await redisHelpers.getList<string>(`${queueKey}:tasks`);
    
    const tasks = await Promise.all(
      taskIds.map(taskId => this.getTask(taskId))
    );
    
    return tasks.filter((task): task is Task => task !== null);
  }

  static async getTask(taskId: string): Promise<Task | null> {
    const taskKey = generateKeys.taskKey(taskId);
    return await redisHelpers.getJSON<Task>(taskKey);
  }

  static async addTask(name: string, data: any, options: TaskOptions) {
    const taskId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const task: Task = {
      id: taskId,
      name,
      queue: options.queue || 'default',
      group: options.group,
      state: 'waiting',
      createdAt: new Date().toISOString(),
      data,
      options,
    };

    const taskKey = generateKeys.taskKey(taskId);
    await redisHelpers.setJSON(taskKey, task);

    const queueKey = generateKeys.queueKey(task.queue);
    await redisHelpers.addToList(`${queueKey}:tasks`, taskId);

    if (options.group) {
      const groupKey = generateKeys.groupKey(options.group);
      await redisHelpers.addToList(`${groupKey}:tasks`, taskId);
    }

    return task;
  }

  static async removeTask(taskId: string) {
    const task = await this.getTask(taskId);
    if (!task) return false;

    const taskKey = generateKeys.taskKey(taskId);
    await redis.del(taskKey);

    const queueKey = generateKeys.queueKey(task.queue);
    await redis.lrem(`${queueKey}:tasks`, 0, taskId);

    if (task.group) {
      const groupKey = generateKeys.groupKey(task.group);
      await redis.lrem(`${groupKey}:tasks`, 0, taskId);
    }

    return true;
  }

  static async getQueueMetricsHistory(queueName: string, start?: number, end?: number) {
    const metricsKey = generateKeys.metricsKey('queue', queueName);
    const metrics = await redisHelpers.getList<QueueMetrics>(`${metricsKey}:history`);
    
    if (start && end) {
      return metrics.filter(m => m.timestamp >= start && m.timestamp <= end);
    }
    
    return metrics;
  }
} 