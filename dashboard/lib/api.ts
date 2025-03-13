import axios from 'axios';
import type {
  QueuesResponse,
  QueueMetricsResponse,
  GroupsResponse,
  GroupTasksResponse,
  GroupStatsResponse,
  Task,
  TaskOptions,
  QueueResponse,
  TaskResponse,
  WorkersResponse,
  WorkerMetricsResponse,
  Worker,
} from '../types/api';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
});

// Queues API
export const getQueues = () => 
  api.get<QueuesResponse>('/api/queues/get-all').then(res => res.data);

export const getQueue = (queueName: string) =>
  api.get<QueueResponse>(`/api/queues/get-by-name/${queueName}`).then(res => res.data);

export const getTask = (taskId: string) =>
  api.get<TaskResponse>(`/api/queues/get-task/${taskId}`).then(res => res.data);

export const getQueueMetrics = () => 
  api.get<QueueMetricsResponse>('/api/queues/metrics').then(res => res.data);

export const getQueueMetricsForQueue = (queueName: string, start?: number, end?: number) => 
  api.get<QueueMetricsResponse>(`/api/queues/${queueName}/metrics`, {
    params: { start, end }
  }).then(res => res.data);

export const addTask = (name: string, data: any, options: TaskOptions) => 
  api.post<Task>('/api/queues/add-task', { name, data, options }).then(res => res.data);

export const deleteTask = (taskId: string) => 
  api.delete(`/api/queues/remove-task/${taskId}`).then(res => res.data);

// Groups API
export const getGroups = () => 
  api.get<GroupsResponse>('/api/groups').then(res => res.data);

export const getGroupTasks = (groupName: string) => 
  api.get<GroupTasksResponse>(`/api/groups/${groupName}/tasks`).then(res => res.data);

export const addTaskToGroup = (
  groupName: string,
  methodName: string,
  data: any,
  options: TaskOptions
) => 
  api.post(`/api/groups/${groupName}/tasks`, {
    methodName,
    data,
    options
  }).then(res => res.data);

export const setGroupPriority = (groupName: string, priority: number) => 
  api.put(`/api/groups/${groupName}/priority`, { priority }).then(res => res.data);

export const getGroupStats = (groupName: string) => 
  api.get<GroupStatsResponse>(`/api/groups/${groupName}/stats`).then(res => res.data);

// Workers API
export const getWorkers = (queue?: string) => 
  api.get<WorkersResponse>('/api/workers', { params: { queue } }).then(res => res.data);

export const getWorker = (workerId: string) =>
  api.get<Worker>(`/api/workers/${workerId}`).then(res => res.data);

export const pauseWorker = (workerId: string) =>
  api.post(`/api/workers/${workerId}/pause`).then(res => res.data);

export const resumeWorker = (workerId: string) =>
  api.post(`/api/workers/${workerId}/resume`).then(res => res.data);

export const getWorkerMetrics = (workerId: string) =>
  api.get<WorkerMetricsResponse>(`/api/workers/${workerId}/metrics`).then(res => res.data); 