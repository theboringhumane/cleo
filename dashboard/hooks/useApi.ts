import useSWR from 'swr';
import type { AxiosError } from 'axios';
import {
  getQueues,
  getQueue,
  getTask,
  getQueueMetrics,
  getQueueMetricsForQueue,
  getGroups,
  getGroupTasks,
  getGroupStats,
  getWorkers,
  getWorker,
  getWorkerMetrics,
} from '../lib/api';
import type {
  QueuesResponse,
  QueueResponse,
  TaskResponse,
  QueueMetricsResponse,
  GroupsResponse,
  GroupTasksResponse,
  GroupStatsResponse,
  WorkersResponse,
  WorkerMetricsResponse,
  Worker,
} from '../types/api';

// Queues hooks
export function useQueues() {
  return useSWR<QueuesResponse, AxiosError>('queues', getQueues);
}

export function useQueue(queueName: string) {
  return useSWR<QueueResponse, AxiosError>(
    ['queue', queueName],
    () => getQueue(queueName),
    {
      refreshInterval: 5000, // Refresh every 5 seconds
    }
  );
}

export function useTask(taskId: string) {
  return useSWR<TaskResponse, AxiosError>(
    ['task', taskId],
    () => getTask(taskId),
    {
      refreshInterval: 5000, // Refresh every 5 seconds
    }
  );
}

export function useQueueMetrics() {
  return useSWR<QueueMetricsResponse, AxiosError>('queue-metrics', getQueueMetrics);
}

export function useQueueMetricsForQueue(queueName: string, start?: number, end?: number) {
  return useSWR<QueueMetricsResponse, AxiosError>(
    ['queue-metrics', queueName, start, end],
    () => getQueueMetricsForQueue(queueName, start, end),
    {
      refreshInterval: 5000, // Refresh every 5 seconds
    }
  );
}

// Groups hooks
export function useGroups() {
  return useSWR<GroupsResponse, AxiosError>('groups', getGroups);
}

export function useGroupTasks(groupName: string) {
  return useSWR<GroupTasksResponse, AxiosError>(
    ['group-tasks', groupName],
    () => getGroupTasks(groupName),
    {
      refreshInterval: 5000,
    }
  );
}

export function useGroupStats(groupName: string) {
  return useSWR<GroupStatsResponse, AxiosError>(
    ['group-stats', groupName],
    () => getGroupStats(groupName),
    {
      refreshInterval: 5000,
    }
  );
}

// Workers hooks
export function useWorkers(queue?: string) {
  return useSWR<WorkersResponse, AxiosError>(
    ['workers', queue],
    () => getWorkers(queue),
    {
      refreshInterval: 5000, // Refresh every 5 seconds
    }
  );
}

export function useWorker(workerId: string) {
  return useSWR<Worker, AxiosError>(
    ['worker', workerId],
    () => getWorker(workerId),
    {
      refreshInterval: 5000, // Refresh every 5 seconds
    }
  );
}

export function useWorkerMetrics(workerId: string) {
  return useSWR<WorkerMetricsResponse, AxiosError>(
    ['worker-metrics', workerId],
    () => getWorkerMetrics(workerId),
    {
      refreshInterval: 5000, // Refresh every 5 seconds
    }
  );
} 