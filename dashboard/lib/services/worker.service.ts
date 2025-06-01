import { redis, generateKeys, redisHelpers, KEYS } from '../redis';
import type { Worker, WorkerMetrics } from '@/types/api';

export class WorkerService {
  static async getAllWorkers(queueFilter?: string) {
    const workers = await redisHelpers.getSetMembers<string>(`${KEYS.WORKER_PREFIX}set`);
    
    const workerDetails = await Promise.all(
      workers
        .filter(workerId => !queueFilter || workerId.startsWith(`${queueFilter}:`))
        .map(async (workerId) => {
          return await this.getWorker(workerId);
        })
    );
    
    return workerDetails.filter((worker): worker is Worker => worker !== null);
  }

  static async getWorker(workerId: string): Promise<Worker | null> {
    const workerKey = generateKeys.workerKey(workerId);
    const worker = await redisHelpers.getJSON<Worker>(workerKey);
    
    if (!worker) return null;
    
    const metrics = await this.getWorkerMetrics(workerId);
    return {
      ...worker,
      metrics,
    };
  }

  static async getWorkerMetrics(workerId: string): Promise<WorkerMetrics> {
    const metricsKey = generateKeys.metricsKey('worker', workerId);
    const metrics = await redisHelpers.getHashAsObject<WorkerMetrics>(metricsKey);
    
    return metrics || {
      active: 0,
      completed: 0,
      failed: 0,
      uptime: 0,
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
      },
      cpu: {
        user: 0,
        system: 0,
      },
      timestamp: Date.now(),
    };
  }

  static async getWorkerMetricsHistory(workerId: string, start?: number, end?: number) {
    const metricsKey = generateKeys.metricsKey('worker', workerId);
    const metrics = await redisHelpers.getList<WorkerMetrics>(`${metricsKey}:history`);
    
    if (start && end) {
      return metrics.filter(m => m.timestamp >= start && m.timestamp <= end);
    }
    
    return metrics;
  }

  static async updateWorkerStatus(workerId: string, status: Worker['status']) {
    const workerKey = generateKeys.workerKey(workerId);
    const worker = await this.getWorker(workerId);
    
    if (!worker) return null;
    
    const updatedWorker = {
      ...worker,
      status,
      lastHeartbeat: Date.now(),
    };
    
    await redisHelpers.setJSON(workerKey, updatedWorker);
    return updatedWorker;
  }

  static async updateWorkerMetrics(workerId: string, metrics: Partial<WorkerMetrics>) {
    const metricsKey = generateKeys.metricsKey('worker', workerId);
    const currentMetrics = await this.getWorkerMetrics(workerId);
    
    const updatedMetrics = {
      ...currentMetrics,
      ...metrics,
      timestamp: Date.now(),
    };
    
    await redisHelpers.setHashFromObject(metricsKey, updatedMetrics);
    await redisHelpers.addToList(`${metricsKey}:history`, updatedMetrics);
    
    return updatedMetrics;
  }

  static async removeWorker(workerId: string) {
    const workerKey = generateKeys.workerKey(workerId);
    const worker = await this.getWorker(workerId);
    
    if (!worker) return false;
    
    await redis.del(workerKey);
    await redis.srem(`${KEYS.WORKER_PREFIX}set`, workerId);
    
    return true;
  }
} 