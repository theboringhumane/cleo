# Task History Service

The `TaskHistoryService` provides centralized task history management for the Cleo task queue system. It tracks task execution history across workers, queues, and groups with automatic expiration and efficient storage.

## Features

- **Centralized History Management**: Single service for all task history operations
- **Multiple Storage Levels**: Worker-specific, task-specific, queue-specific, group-specific, and global history
- **Automatic Expiration**: Configurable TTL for all history entries
- **Statistics**: Built-in analytics for task performance and success rates
- **Efficient Storage**: Uses Redis lists with automatic trimming to prevent memory bloat
- **Error Handling**: Comprehensive error handling with detailed logging

## Usage

### Basic Setup

```typescript
import { TaskHistoryService } from "@cleo/core";

// Get the singleton instance
const taskHistoryService = TaskHistoryService.getInstance();
```

### Adding Task History

```typescript
// Add a completed task
await taskHistoryService.addTaskHistory(
  "task-123",           // taskId
  "completed",          // status
  1500,                 // duration in ms
  "worker-1",           // workerId
  "email-queue",        // queueName
  undefined,            // error (optional)
  "email-group"         // group (optional)
);

// Add a failed task
await taskHistoryService.addTaskHistory(
  "task-124",
  "failed",
  800,
  "worker-1",
  "email-queue",
  "Connection timeout", // error message
  "email-group"
);
```

### Retrieving History

#### Worker-Specific History
```typescript
// Get last 100 tasks for a specific worker
const workerHistory = await taskHistoryService.getWorkerHistory("worker-1", 100);
console.log(`Worker processed ${workerHistory.length} tasks`);
```

#### Task-Specific History
```typescript
// Get history for a specific task (useful for retries/debugging)
const taskHistory = await taskHistoryService.getTaskHistory("task-123", 50);
console.log(`Task has ${taskHistory.length} history entries`);
```

#### Queue-Specific History
```typescript
// Get history for all tasks in a queue
const queueHistory = await taskHistoryService.getQueueHistory("email-queue", 500);
console.log(`Queue processed ${queueHistory.length} tasks`);
```

#### Group-Specific History
```typescript
// Get history for all tasks in a group
const groupHistory = await taskHistoryService.getGroupHistory("email-group", 200);
console.log(`Group processed ${groupHistory.length} tasks`);
```

#### Global History
```typescript
// Get global history across all workers and queues
const globalHistory = await taskHistoryService.getGlobalHistory(1000);
console.log(`System processed ${globalHistory.length} tasks`);
```

### Statistics

```typescript
// Get comprehensive statistics
const stats = await taskHistoryService.getHistoryStats();
console.log({
  totalTasks: stats.totalTasks,
  completedTasks: stats.completedTasks,
  failedTasks: stats.failedTasks,
  averageDuration: stats.averageDuration,
  successRate: (stats.completedTasks / stats.totalTasks) * 100
});
```

### Cleanup Operations

```typescript
// Clear history for a specific worker
await taskHistoryService.clearWorkerHistory("worker-1");

// Clear all task history (use with caution!)
await taskHistoryService.clearAllHistory();
```

## Data Structure

### ExtendedTaskHistoryEntry

```typescript
interface ExtendedTaskHistoryEntry extends TaskHistoryEntry {
  taskId: string;
  timestamp: string;        // ISO string
  status: string;           // "completed", "failed", etc.
  duration: number;         // milliseconds
  error?: string;           // error message if failed
  group?: string;           // task group name
  workerId?: string;        // worker that processed the task
  queueName?: string;       // queue the task was in
}
```

## Storage Strategy

The service stores task history in multiple Redis keys for efficient querying:

- **Worker History**: `task_history:worker-{workerId}` (last 100 entries)
- **Task History**: `task_history:task:{taskId}` (last 50 entries per task)
- **Queue History**: `task_history:queue:{queueName}` (last 500 entries per queue)
- **Group History**: `task_history:group:{groupName}` (last 200 entries per group)
- **Global History**: `task_history:global` (last 1000 entries globally)

All keys have automatic expiration based on the `TASK_HISTORY_EXPIRE` constant.

## Integration with Workers

The `TaskHistoryService` is automatically integrated with the `Worker` class:

```typescript
import { Worker } from "@cleo/core";

const worker = new Worker("email-queue", emailProcessor);

// Get worker's task history
const history = await worker.getTaskHistory(50);

// Get history for a specific task
const taskHistory = await worker.getTaskHistoryById("task-123");

// Get global history
const globalHistory = await worker.getGlobalTaskHistory(100);
```

## Integration with WorkerManager

The `WorkerManager` also provides access to task history:

```typescript
import { WorkerManager } from "@cleo/core";

const workerManager = WorkerManager.getInstance();

// Get history for any worker
const history = await workerManager.getTaskHistory("worker-1");

// Get statistics
const stats = await workerManager.getTaskHistoryStats();
```

## Configuration

Task history behavior is controlled by constants in `src/constants.ts`:

```typescript
export const TASK_HISTORY_KEY = "task_history:";
export const TASK_HISTORY_EXPIRE = 7 * 24 * 60 * 60; // 7 days in seconds
```

## Performance Considerations

- **Memory Usage**: Lists are automatically trimmed to prevent unbounded growth
- **Expiration**: All history keys expire after 7 days by default
- **Indexing**: Uses Redis lists for O(1) insertion and efficient range queries
- **Batching**: Consider batching history writes for high-throughput scenarios

## Error Handling

The service includes comprehensive error handling:

```typescript
try {
  await taskHistoryService.addTaskHistory(/* ... */);
} catch (error) {
  // Service logs errors automatically
  console.error("Failed to add task history:", error);
}

// Methods return empty arrays on error rather than throwing
const history = await taskHistoryService.getWorkerHistory("worker-1");
// Returns [] if there's an error, never throws
```

## Example: Monitoring Task Performance

```typescript
async function monitorTaskPerformance() {
  const taskHistoryService = TaskHistoryService.getInstance();
  
  // Get recent global history
  const recentTasks = await taskHistoryService.getGlobalHistory(100);
  
  // Analyze performance
  const completedTasks = recentTasks.filter(t => t.status === 'completed');
  const failedTasks = recentTasks.filter(t => t.status === 'failed');
  
  const avgDuration = completedTasks.reduce((sum, t) => sum + t.duration, 0) / completedTasks.length;
  const successRate = (completedTasks.length / recentTasks.length) * 100;
  
  console.log({
    totalTasks: recentTasks.length,
    successRate: `${successRate.toFixed(1)}%`,
    averageDuration: `${avgDuration.toFixed(0)}ms`,
    slowestTask: Math.max(...completedTasks.map(t => t.duration)),
    fastestTask: Math.min(...completedTasks.map(t => t.duration))
  });
}
```

## Example: Queue Health Monitoring

```typescript
async function monitorQueueHealth(queueName: string) {
  const taskHistoryService = TaskHistoryService.getInstance();
  
  // Get recent queue history
  const queueHistory = await taskHistoryService.getQueueHistory(queueName, 200);
  
  // Group by hour
  const hourlyStats = queueHistory.reduce((acc, task) => {
    const hour = new Date(task.timestamp).getHours();
    if (!acc[hour]) acc[hour] = { completed: 0, failed: 0, totalDuration: 0 };
    
    if (task.status === 'completed') {
      acc[hour].completed++;
      acc[hour].totalDuration += task.duration;
    } else if (task.status === 'failed') {
      acc[hour].failed++;
    }
    
    return acc;
  }, {});
  
  console.log(`Queue ${queueName} hourly performance:`, hourlyStats);
}
```

## Best Practices

1. **Regular Monitoring**: Use the statistics methods to monitor system health
2. **Error Analysis**: Regularly check failed tasks to identify patterns
3. **Performance Tuning**: Use duration data to optimize task processing
4. **Cleanup**: Periodically clear old worker history if needed
5. **Alerting**: Set up alerts based on failure rates or performance degradation

## See Also

- [Worker Documentation](./WORKERS.md)
- [Queue Management](./QUEUES.md)
- [Task Groups](./TASK_GROUPS.md)
- [Configuration](./CONFIGURATION.md) 