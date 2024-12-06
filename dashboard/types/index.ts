export interface QueueMetrics {
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
}

export interface Task {
  id: string;
  name: string;
  state: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILURE' | 'RETRY';
  createdAt: string;
  updatedAt: string;
} 