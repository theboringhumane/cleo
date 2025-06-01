import { redis, generateKeys, redisHelpers, KEYS } from '../redis';
import type { Group, GroupMetrics, GroupConfig, Task } from '@/types/api';

export class GroupService {
  static async getAllGroups() {
    const groups = await redisHelpers.getSetMembers<string>(`${KEYS.GROUP_PREFIX}set`);
    
    const groupDetails = await Promise.all(groups.map(async (groupName) => {
      const metrics = await this.getGroupMetrics(groupName);
      const config = await this.getGroupConfig(groupName);
      const tasks = await this.getGroupTasks(groupName);
      
      return {
        name: groupName,
        metrics,
        config,
        tasks,
      };
    }));
    
    return groupDetails;
  }

  static async getGroupByName(groupName: string) {
    const metrics = await this.getGroupMetrics(groupName);
    const config = await this.getGroupConfig(groupName);
    const tasks = await this.getGroupTasks(groupName);
    
    return {
      name: groupName,
      metrics,
      config,
      tasks,
    };
  }

  static async getGroupMetrics(groupName: string): Promise<GroupMetrics> {
    const metricsKey = generateKeys.metricsKey('group', groupName);
    const metrics = await redisHelpers.getHashAsObject<GroupMetrics>(metricsKey);
    
    return metrics || {
      total: 0,
      active: 0,
      completed: 0,
      failed: 0,
      waiting: 0,
      avgProcessingTime: 0,
      timestamp: Date.now(),
    };
  }

  static async getGroupConfig(groupName: string): Promise<GroupConfig> {
    const groupKey = generateKeys.groupKey(groupName);
    const config = await redisHelpers.getJSON<GroupConfig>(`${groupKey}:config`);
    
    return config || {
      strategy: 'fifo',
      concurrency: 1,
      maxConcurrency: 10,
      priority: 0,
      weight: 1,
      rateLimit: {
        max: 1000,
        duration: 60000,
      },
    };
  }

  static async setGroupConfig(groupName: string, config: Partial<GroupConfig>) {
    const groupKey = generateKeys.groupKey(groupName);
    const currentConfig = await this.getGroupConfig(groupName);
    const newConfig = { ...currentConfig, ...config };
    
    await redisHelpers.setJSON(`${groupKey}:config`, newConfig);
    return newConfig;
  }

  static async getGroupTasks(groupName: string): Promise<Task[]> {
    const groupKey = generateKeys.groupKey(groupName);
    const taskIds = await redisHelpers.getList<string>(`${groupKey}:tasks`);
    
    const tasks = await Promise.all(
      taskIds.map(async (taskId) => {
        const taskKey = generateKeys.taskKey(taskId);
        return await redisHelpers.getJSON<Task>(taskKey);
      })
    );
    
    return tasks.filter((task): task is Task => task !== null);
  }

  static async getGroupMetricsHistory(groupName: string, start?: number, end?: number) {
    const metricsKey = generateKeys.metricsKey('group', groupName);
    const metrics = await redisHelpers.getList<GroupMetrics>(`${metricsKey}:history`);
    
    if (start && end) {
      return metrics.filter(m => m.timestamp >= start && m.timestamp <= end);
    }
    
    return metrics;
  }

  static async updateGroupPriority(groupName: string, priority: number) {
    return await this.setGroupConfig(groupName, { priority });
  }

  static async getGroupStats(groupName: string) {
    const metrics = await this.getGroupMetrics(groupName);
    const history = await this.getGroupMetricsHistory(groupName);
    const config = await this.getGroupConfig(groupName);
    
    const stats = {
      ...metrics,
      successRate: metrics.completed / (metrics.completed + metrics.failed || 1),
      throughput: metrics.completed / (metrics.avgProcessingTime || 1),
      concurrencyUtilization: metrics.active / config.maxConcurrency,
      history: history.slice(-100), // Last 100 metrics points
    };
    
    return stats;
  }
} 