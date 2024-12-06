import { cleo, TaskState, TaskPriority } from '../src';
import { logger } from '../src/utils/logger';

// Configure Cleo with Redis connection and priority queues
cleo.configure({
  redis: {
    host: 'localhost',
    port: 6379,
  },
  worker: {
    concurrency: 3,
    queues: [
      {
        name: 'high-priority',
        priority: 3,
        rateLimit: {
          max: 100,
          interval: 60000, // 100 jobs per minute
        },
      },
      {
        name: 'normal-priority',
        priority: 2,
        rateLimit: {
          max: 50,
          interval: 60000, // 50 jobs per minute
        },
      },
      {
        name: 'low-priority',
        priority: 1,
        rateLimit: {
          max: 10,
          interval: 60000, // 10 jobs per minute
        },
      },
    ],
  },
});

// Define tasks with different priorities
class PriorityTasks {
  @cleo.task({
    queue: 'high-priority',
    priority: TaskPriority.HIGH,
  })
  async processUrgentEmail(data: { email: string; content: string }) {
    logger.info('priority-queues.ts', '🚨', '50', 'processUrgentEmail', 'data', 'Processing urgent email:', data);
    await new Promise(resolve => setTimeout(resolve, 500));
    return { status: TaskState.SUCCESS };
  }

  @cleo.task({
    queue: 'normal-priority',
    priority: TaskPriority.NORMAL,
  })
  async processNotification(data: { userId: string; message: string }) {
    logger.info('priority-queues.ts', '📬', '59', 'processNotification', 'data', 'Processing notification:', data);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { status: TaskState.SUCCESS };
  }

  @cleo.task({
    queue: 'low-priority',
    priority: TaskPriority.LOW,
  })
  async processAnalytics(data: { eventType: string; metadata: any }) {
    logger.info('priority-queues.ts', '📊', '68', 'processAnalytics', 'data', 'Processing analytics:', data);
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { status: TaskState.SUCCESS };
  }
}

async function main() {
  try {
    const tasks = new PriorityTasks();

    // Add tasks with different priorities
    const promises = [];

    // High priority tasks
    for (let i = 0; i < 5; i++) {
      promises.push(tasks.processUrgentEmail({
        email: `urgent${i}@example.com`,
        content: `Urgent message ${i}`,
      }));
    }

    // Normal priority tasks
    for (let i = 0; i < 10; i++) {
      promises.push(tasks.processNotification({
        userId: `user${i}`,
        message: `Notification ${i}`,
      }));
    }

    // Low priority tasks
    for (let i = 0; i < 15; i++) {
      promises.push(tasks.processAnalytics({
        eventType: `event${i}`,
        metadata: { timestamp: Date.now() },
      }));
    }

    await Promise.all(promises);
    logger.info('priority-queues.ts', '✅', '106', 'main', '', 'All tasks added to queues');

    // Keep process alive to process tasks
    await new Promise(resolve => setTimeout(resolve, 30000));
    process.exit(0);
  } catch (error) {
    logger.error('priority-queues.ts', '❌', '112', 'main', 'error', 'Error:', error);
    process.exit(1);
  }
}

main(); 