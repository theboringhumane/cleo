import { Job } from 'bullmq';
import { PriorityQueueManager } from '../queue/priorityQueueManager';
import { TaskState, TaskPriority } from '../types/enums';
import { QueueConfig, Task } from '../types/interfaces';
import { jest } from '@jest/globals';
import { mockJob } from './setup';

// Increase timeout for async tests
jest.setTimeout(10000);

describe('PriorityQueueManager', () => {
  let manager: PriorityQueueManager;
  const mockConfigs: QueueConfig[] = [
    {
      name: 'high-priority',
      priority: TaskPriority.HIGH,
      rateLimit: { max: 100, interval: 1000 },
    },
    {
      name: 'normal-priority',
      priority: TaskPriority.NORMAL,
    },
    {
      name: 'low-priority',
      priority: TaskPriority.LOW,
      rateLimit: { max: 10, interval: 1000 },
    },
  ];

  beforeEach(async () => {
    manager = new PriorityQueueManager(mockConfigs);
    // Wait for queues to be ready
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    try {
      await manager.close();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  });

  describe('Queue Management', () => {
    it('should initialize queues in priority order', () => {
      const queueNames = manager['queues'].keys();
      expect(Array.from(queueNames)).toEqual([
        'high-priority',
        'normal-priority',
        'low-priority',
      ]);
    });

    it('should handle queue initialization errors', () => {
      const invalidConfig: QueueConfig = {
        name: '',  // Invalid name
        priority: -1,  // Invalid priority
      };
      
      expect(() => new PriorityQueueManager([invalidConfig]))
        .toThrow();
    });

    it('should respect rate limits when adding tasks', async () => {
      const task: Task = createTestTask('rate-limit-test');
      const rateLimitConfig = mockConfigs.find(c => c.name === 'high-priority')?.rateLimit;
      expect(rateLimitConfig).toBeDefined();

      // Add tasks rapidly to trigger rate limit
      const results = await Promise.all(
        Array(rateLimitConfig!.max + 5).fill(null).map(() => 
          manager.addTask('high-priority', task)
        )
      );

      // Some tasks should be rate limited
      const successfulTasks = results.filter(Boolean);
      expect(successfulTasks.length).toBeLessThanOrEqual(rateLimitConfig!.max);
    });

    it('should handle task addition errors gracefully', async () => {
      const invalidTask = { ...createTestTask('invalid'), id: null };
      
      await expect(async () => {
        await manager.addTask('high-priority', invalidTask as unknown as Task);
      }).rejects.toThrow();
    });
  });

  describe('Task Processing', () => {
    it('should process high priority tasks first', async () => {
      const processedTasks: string[] = [];
      const mockProcessor = jest.fn(async (job: Job) => {
        processedTasks.push(job.data.name);
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate work
        return { success: true };
      });

      // Add tasks in reverse priority order
      await Promise.all([
        manager.addTask('low-priority', createTestTask('low-1')),
        manager.addTask('normal-priority', createTestTask('normal-1')),
        manager.addTask('high-priority', createTestTask('high-1')),
      ]);

      // Process tasks
      await Promise.all(processedTasks.map(async (_, index) => {
        await mockProcessor(mockJob as unknown as Job);
      }));

      // Verify high priority task was processed first
      expect(processedTasks[0]).toBe('high-1');
    });

    it('should handle failed tasks correctly', async () => {
      const errorTask = createTestTask('error-task');
      const mockProcessor = jest.fn().mockImplementation(() => {
        throw new Error('Task failed');
      });

      const job = await manager.addTask('high-priority', errorTask);
      expect(job).toBeDefined();
      
      try {
        await mockProcessor(job as unknown as Job);
      } catch (error) {
        // Expected error
      }

      const state = await job?.getState();
      expect(state).toBe('failed');
    });
  });

  describe('Metrics', () => {
    it('should track queue metrics correctly', async () => {
      const tasks = [
        createTestTask('metric-test-1'),
        createTestTask('metric-test-2'),
      ];

      await Promise.all(tasks.map(task => 
        manager.addTask('high-priority', task)
      ));

      const metrics = await manager.getQueueMetrics('high-priority');
      expect(metrics).toBeDefined();
      expect(metrics?.metrics.waiting).toBeGreaterThanOrEqual(0);
    });

    it('should track rate limit metrics', async () => {
      const task = createTestTask('rate-limit-test');
      
      // Add tasks rapidly
      await Promise.all(
        Array(20).fill(null).map(() => 
          manager.addTask('high-priority', task)
        )
      );

      const metrics = await manager.getQueueMetrics('high-priority');
      expect(metrics?.rateLimit?.current).toBeDefined();
      expect(metrics?.rateLimit?.current).toBeGreaterThanOrEqual(0);
    });

    it('should handle metrics retrieval errors', async () => {
      const metrics = await manager.getQueueMetrics('non-existent');
      expect(metrics).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors', async () => {
      const errorManager = new PriorityQueueManager(mockConfigs);
      await errorManager.close(); // Force close connection
      
      const task = createTestTask('error');
      await expect(async () => {
        await errorManager.addTask('high-priority', task);
      }).rejects.toThrow();
    });

    it('should handle worker errors', async () => {
      const errorTask = createTestTask('worker-error');
      const job = await manager.addTask('high-priority', errorTask);

      // Simulate worker error
      await manager.processJob(job as unknown as Job);

      const jobState = await manager.getTaskState(job!.id as string);
      expect(jobState).toBe(TaskState.FAILURE);
    });
  });
});

function createTestTask(name: string): Task {
  return {
    id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    data: { timestamp: Date.now() },
    options: {},
    state: TaskState.PENDING,
    retryCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
} 