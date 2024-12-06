import { QueueManager } from '../queue/queueManager';
import { Task, TaskOptions } from '../types/interfaces';
import { TaskPriority, TaskState } from '../types/enums';
import { jest } from '@jest/globals';

jest.mock('bullmq');
jest.mock('ioredis');

describe('QueueManager', () => {
  let queueManager: QueueManager;
  const TEST_QUEUE_NAME = 'test-queue';

  beforeEach(() => {
    queueManager = new QueueManager(TEST_QUEUE_NAME);
  });

  afterEach(async () => {
    await queueManager.close();
  });

  describe('addTask', () => {
    it('should successfully add a task', async () => {
      const taskData = {
        key: 'value'
      };

      const options: TaskOptions = {
        priority: TaskPriority.HIGH,
        maxRetries: 3
      };

      const task = await queueManager.addTask('testTask', taskData, options);
      expect(task).toBeDefined();
      expect(task.id).toContain('testTask');
      expect(task.state).toBe(TaskState.PENDING);
      expect(task.data).toEqual(taskData);
      expect(task.options).toEqual(options);
    });

    it('should handle task with backoff options', async () => {
      const taskData = {
        key: 'value'
      };

      const options: TaskOptions = {
        priority: TaskPriority.HIGH,
        maxRetries: 3,
        retryDelay: 1000
      };

      const task = await queueManager.addTask('testTaskWithBackoff', taskData, options);
      expect(task).toBeDefined();
      expect(task.options.retryDelay).toBe(1000);
    });

    it('should handle task with schedule', async () => {
      const taskData = {
        key: 'value'
      };

      const options: TaskOptions = {
        schedule: '0 0 * * *',
        priority: TaskPriority.NORMAL
      };

      const task = await queueManager.addTask('scheduledTask', taskData, options);
      expect(task).toBeDefined();
      expect(task.options.schedule).toBe('0 0 * * *');
    });

    it('should handle task with timeout', async () => {
      const taskData = {
        key: 'value'
      };

      const options: TaskOptions = {
        timeout: 3600,
        priority: TaskPriority.NORMAL
      };

      const task = await queueManager.addTask('timedTask', taskData, options);
      expect(task).toBeDefined();
      expect(task.options.timeout).toBe(3600);
    });
  });

  describe('getTask', () => {
    it('should return task if it exists', async () => {
      const taskData = { key: 'value' };
      const addedTask = await queueManager.addTask('testTask', taskData);
      
      const task = await queueManager.getTask(addedTask.id, TEST_QUEUE_NAME);
      expect(task).toBeDefined();
      expect(task?.id).toBe(addedTask.id);
      expect(task?.data).toEqual(taskData);
    });

    it('should return null for non-existent task', async () => {
      const task = await queueManager.getTask('non-existent', TEST_QUEUE_NAME);
      expect(task).toBeNull();
    });

    it('should return null for non-existent queue', async () => {
      await expect(queueManager.getTask('test-id', 'non-existent-queue'))
        .rejects.toThrow('Queue not found');
    });
  });

  describe('removeTask', () => {
    it('should remove existing task', async () => {
      const taskData = { key: 'value' };
      const addedTask = await queueManager.addTask('testTask', taskData);
      
      const result = await queueManager.removeTask(addedTask.id, TEST_QUEUE_NAME);
      expect(result).toBe(true);
      
      const task = await queueManager.getTask(addedTask.id, TEST_QUEUE_NAME);
      expect(task).toBeNull();
    });

    it('should return false for non-existent task', async () => {
      const result = await queueManager.removeTask('non-existent', TEST_QUEUE_NAME);
      expect(result).toBe(false);
    });

    it('should return false for non-existent queue', async () => {
      const result = await queueManager.removeTask('test-id', 'non-existent-queue');
      expect(result).toBe(false);
    });
  });
}); 