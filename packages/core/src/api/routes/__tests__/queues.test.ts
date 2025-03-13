import { FastifyInstance } from 'fastify';
import { createServer } from '../../server';
import { QueueManager } from '../../../queue/queueManager';
import { QueueMetricsData } from '../../../queue/queueMetrics';
import { Cleo } from '../../../index';

// Mock the cleo instance and QueueManager
const mockGetQueueMetrics = jest.fn();
const mockGetLatestQueueMetrics = jest.fn();
const mockGetAllQueueMetrics = jest.fn();
const mockGetAllTasks = jest.fn();
const mockAddTask = jest.fn();
const mockRemoveTask = jest.fn();

const mockQueueManager = {
  getQueueMetrics: mockGetQueueMetrics,
  getLatestQueueMetrics: mockGetLatestQueueMetrics,
  getAllQueueMetrics: mockGetAllQueueMetrics,
  getAllTasks: mockGetAllTasks,
  addTask: mockAddTask,
  removeTask: mockRemoveTask,
} as unknown as QueueManager;

const mockCleo = {
  getQueueManager: () => mockQueueManager,
} as unknown as Cleo;

describe('Queue API Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer(mockCleo);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/queues/metrics', () => {
    const mockMetrics: Record<string, QueueMetricsData> = {
      'default': {
        waiting: 5,
        active: 2,
        completed: 10,
        failed: 1,
        delayed: 0,
        paused: 0,
        averageWaitingTime: 1000,
        timestamp: Date.now(),
      },
      'high-priority': {
        waiting: 2,
        active: 1,
        completed: 5,
        failed: 0,
        delayed: 1,
        paused: 0,
        averageWaitingTime: 500,
        timestamp: Date.now(),
      },
    };

    it('should return metrics for all queues', async () => {
      mockGetAllQueueMetrics.mockResolvedValue(mockMetrics);

      const response = await app.inject({
        method: 'GET',
        url: '/api/queues/metrics',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ metrics: mockMetrics });
      expect(mockGetAllQueueMetrics).toHaveBeenCalledTimes(1);
    });

    it('should handle errors when fetching all queue metrics', async () => {
      mockGetAllQueueMetrics.mockRejectedValue(new Error('Redis connection failed'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/queues/metrics',
      });

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Failed to fetch queue metrics',
      });
    });
  });

  describe('GET /api/queues/:queueName/metrics', () => {
    const mockQueueMetrics: QueueMetricsData = {
      waiting: 5,
      active: 2,
      completed: 10,
      failed: 1,
      delayed: 0,
      paused: 0,
      averageWaitingTime: 1000,
      timestamp: Date.now(),
    };

    it('should return latest metrics for a specific queue', async () => {
      mockGetLatestQueueMetrics.mockResolvedValue(mockQueueMetrics);

      const response = await app.inject({
        method: 'GET',
        url: '/api/queues/default/metrics',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ metrics: mockQueueMetrics });
      expect(mockGetLatestQueueMetrics).toHaveBeenCalledWith('default');
    });

    it('should return metrics for a specific time range', async () => {
      const timeRangeMetrics = [mockQueueMetrics];
      mockGetQueueMetrics.mockResolvedValue(timeRangeMetrics);

      const start = Date.now() - 3600000; // 1 hour ago
      const end = Date.now();

      const response = await app.inject({
        method: 'GET',
        url: `/api/queues/default/metrics?start=${start}&end=${end}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ metrics: timeRangeMetrics });
      expect(mockGetQueueMetrics).toHaveBeenCalledWith('default', { start, end });
    });

    it('should return 404 when queue metrics are not found', async () => {
      mockGetLatestQueueMetrics.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/queues/nonexistent/metrics',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Queue metrics not found',
      });
    });

    it('should handle errors when fetching queue metrics', async () => {
      mockGetLatestQueueMetrics.mockRejectedValue(new Error('Redis connection failed'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/queues/default/metrics',
      });

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Failed to fetch queue metrics',
      });
    });
  });

  describe('GET /api/queues', () => {
    const mockTasks = [
      { id: '1', name: 'task1', state: 'completed' },
      { id: '2', name: 'task2', state: 'waiting' },
    ];

    it('should return all tasks', async () => {
      mockGetAllTasks.mockResolvedValue(mockTasks);

      const response = await app.inject({
        method: 'GET',
        url: '/api/queues',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ tasks: mockTasks });
      expect(mockGetAllTasks).toHaveBeenCalledTimes(1);
    });

    it('should handle errors when fetching tasks', async () => {
      mockGetAllTasks.mockRejectedValue(new Error('Failed to fetch tasks'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/queues',
      });

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Failed to fetch tasks',
      });
    });
  });

  describe('POST /api/queues', () => {
    const mockTask = {
      name: 'testTask',
      data: { foo: 'bar' },
      options: { priority: 1 },
    };

    it('should create a new task', async () => {
      const createdTask = { ...mockTask, id: '123', state: 'waiting' };
      mockAddTask.mockResolvedValue(createdTask);

      const response = await app.inject({
        method: 'POST',
        url: '/api/queues',
        payload: mockTask,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(createdTask);
      expect(mockAddTask).toHaveBeenCalledWith(
        mockTask.name,
        mockTask.data,
        mockTask.options
      );
    });

    it('should handle errors when creating a task', async () => {
      mockAddTask.mockRejectedValue(new Error('Failed to create task'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/queues',
        payload: mockTask,
      });

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Failed to create task',
      });
    });
  });

  describe('DELETE /api/queues/:taskId', () => {
    it('should delete a task', async () => {
      mockRemoveTask.mockResolvedValue(true);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/queues/123',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        message: 'Task removed successfully',
      });
      expect(mockRemoveTask).toHaveBeenCalledWith('123');
    });

    it('should return 404 when task is not found', async () => {
      mockRemoveTask.mockResolvedValue(false);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/queues/nonexistent',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Task not found',
      });
    });

    it('should handle errors when deleting a task', async () => {
      mockRemoveTask.mockRejectedValue(new Error('Failed to remove task'));

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/queues/123',
      });

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Failed to remove task',
      });
    });
  });
}); 