export type TaskState = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused';

export interface TaskOptions {
  queue?: string;
  group?: string;
  priority?: number;
  weight?: number;
  timeout?: number;
  maxRetries?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  removeOnComplete?: boolean | { age: number; count: number };
  rateLimit?: {
    max: number;
    duration: number;
  };
}

export interface Task {
  id: string;
  name: string;
  queue: string;
  group?: string;
  state: TaskState;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  data: any;
  result?: any;
  error?: {
    message: string;
    stack?: string;
  };
  options: TaskOptions;
  progress?: number;
  attempts?: number;
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

export interface GroupMetrics {
  total: number;
  active: number;
  completed: number;
  failed: number;
  waiting: number;
  avgProcessingTime: number;
  timestamp: number;
}

export interface GroupConfig {
  strategy: 'fifo' | 'lifo' | 'priority' | 'round-robin';
  concurrency: number;
  maxConcurrency: number;
  priority: number;
  weight: number;
  rateLimit: {
    max: number;
    duration: number;
  };
}

export interface WorkerMetrics {
  active: number;
  completed: number;
  failed: number;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  timestamp: number;
}

export interface Worker {
  id: string;
  queue: string;
  status: 'active' | 'idle' | 'paused' | 'stopped';
  metrics: WorkerMetrics;
  lastHeartbeat: number;
}

export interface Group {
  name: string;
  metrics: GroupMetrics;
  config: GroupConfig;
  tasks: Task[];
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

export interface WorkersResponse {
  workers: Worker[];
}

export interface WorkerMetricsResponse {
  current: WorkerMetrics;
  history: (WorkerMetrics & { timestamp: string })[];
} 