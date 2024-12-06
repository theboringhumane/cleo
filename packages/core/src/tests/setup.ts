import { Queue, QueueEvents, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { TaskState } from '../types/enums';

// Mock Redis client for testing
const mockRedisClient = {
  quit: jest.fn().mockResolvedValue(undefined),
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(0),
  publish: jest.fn().mockResolvedValue(1),
  subscribe: jest.fn().mockResolvedValue(undefined),
  unsubscribe: jest.fn().mockResolvedValue(undefined),
};

// Mock BullMQ
jest.mock('bullmq', () => {
  const mockJob = {
    id: 'mock-job-id',
    name: 'mock-job',
    data: {},
    opts: {},
    progress: jest.fn().mockResolvedValue(undefined),
    updateProgress: jest.fn().mockResolvedValue(undefined),
    moveToCompleted: jest.fn().mockResolvedValue(undefined),
    moveToFailed: jest.fn().mockResolvedValue(undefined),
    getState: jest.fn().mockResolvedValue(TaskState.PENDING),
  };

  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn().mockResolvedValue(mockJob),
      close: jest.fn().mockResolvedValue(undefined),
      getJob: jest.fn().mockImplementation((jobId) => {
        if (jobId === 'non-existent') {
          return Promise.resolve(null);
        }
        return Promise.resolve({ ...mockJob, id: jobId });
      }),
      getJobs: jest.fn().mockResolvedValue([mockJob]),
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0,
      }),
      removeJobs: jest.fn().mockResolvedValue(undefined),
    })),
    QueueEvents: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
      removeAllListeners: jest.fn(),
    })),
    Worker: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
      removeAllListeners: jest.fn(),
    })),
  };
});

// Mock IORedis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedisClient);
});

// Global test setup
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
});

// Global test teardown
afterAll(() => {
  // Reset all mocks
  jest.clearAllMocks();
  jest.resetModules();
});

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Export mock instances for test use
export const mockRedis = mockRedisClient;
export const mockJob = {
  id: 'mock-job-id',
  name: 'mock-job',
  data: {},
  opts: {},
  progress: jest.fn().mockResolvedValue(undefined),
  updateProgress: jest.fn().mockResolvedValue(undefined),
  moveToCompleted: jest.fn().mockResolvedValue(undefined),
  moveToFailed: jest.fn().mockResolvedValue(undefined),
  getState: jest.fn().mockResolvedValue(TaskState.PENDING),
}; 