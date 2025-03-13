export interface Task {
  id: string;
  name: string;
  queue: string;
  group?: string;
  state: 'waiting' | 'active' | 'completed' | 'failed';
  createdAt: string;
  data?: any;
  metadata?: {
    attempts?: number;
  };
  options?: TaskOptions;
}

export interface TaskOptions {
  queue?: string;
  group?: string;
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: {
    type: string;
    delay: number;
  };
}

export interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  averageWaitingTime: number;
  timestamp: number;
}

export interface GroupStats {
  total: number;
  active: number;
  completed: number;
  failed: number;
  paused: number;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
}

export interface TaskResponse {
  task: Task;
  history: Array<{
    timestamp: string;
    state: Task['state'];
    data?: any;
  }>;
}

export interface QueuesResponse {
  queues: Array<{
    name: string;
    metrics: QueueMetrics;
    tasks: Task[];
  }>;
}

export interface QueueResponse {
  tasks: Task[];
  metrics: {
    active: number;
    waiting: number;
    completed: number;
    failed: number;
  };
}

export interface QueueMetricsResponse {
  metrics: Array<{
    timestamp: string;
    active: number;
    waiting: number;
    completed: number;
    failed: number;
  }>;
}

export interface GroupsResponse {
  groups: Array<{
    name: string;
    metrics: {
      active: number;
      waiting: number;
      completed: number;
      failed: number;
    };
  }>;
}

export interface GroupTasksResponse {
  tasks: Task[];
}

export interface GroupStatsResponse {
  stats: {
    name: string;
    total: number;
    active: number;
    completed: number;
    failed: number;
    paused: number;
  };
}

export interface TaskHistoryEntry {
  taskId: string;
  timestamp: string;
  status: string;
  duration: number;
  error?: any;
}

export interface WorkerMetrics {
  tasksProcessed: number;
  tasksSucceeded: number;
  tasksFailed: number;
  averageProcessingTime: number;
}

export interface Worker {
  id: string;
  queue: string;
  status: string;
  activeTasks: any[];
  metrics: WorkerMetrics;
  lastHeartbeat: string;
  isActive: boolean;
  history?: TaskHistoryEntry[];
}

export interface WorkersResponse {
  workers: Worker[];
}

export interface WorkerMetricsResponse {
  current: WorkerMetrics;
  history: (WorkerMetrics & { timestamp: string })[];
} 