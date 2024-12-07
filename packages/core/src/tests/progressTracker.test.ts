import { ProgressTracker } from '../progress/progressTracker';
import WebSocket from 'ws';
import { jest } from '@jest/globals';

// Increase timeout for WebSocket tests
jest.setTimeout(10000);

describe('ProgressTracker', () => {
  let tracker: ProgressTracker;
  let wsClient: WebSocket;
  const TEST_PORT = 3002;
  const WS_URL = `ws://localhost:${TEST_PORT}`;

  const waitForSocketState = (socket: WebSocket, state: number): Promise<void> => {
    return new Promise((resolve) => {
      if (socket.readyState === state) {
        resolve();
        return;
      }

      const interval = setInterval(() => {
        if (socket.readyState === state) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  };

  const waitForMessage = (socket: WebSocket): Promise<any> => {
    return new Promise((resolve) => {
      socket.once('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          resolve(message);
        } catch (error) {
          resolve(null);
        }
      });
    });
  };

  beforeEach(async () => {
    tracker = new ProgressTracker(TEST_PORT);
    wsClient = new WebSocket(WS_URL);
    await waitForSocketState(wsClient, WebSocket.OPEN);
  });

  afterEach(async () => {
    const activeSockets = [wsClient].filter(s => s?.readyState === WebSocket.OPEN);
    await Promise.all(activeSockets.map(s => {
      return new Promise<void>((resolve) => {
        s.close();
        s.once('close', () => resolve());
      });
    }));
    
    if (tracker) {
      tracker.close();
    }
  });

  describe('Progress Updates', () => {
    it('should track task progress correctly', () => {
      const taskId = 'test-task-1';
      tracker.updateProgress(taskId, 50);

      const progress = tracker.getProgress(taskId);
      expect(progress).toBeDefined();
      expect(progress?.progress).toBe(50);
    });

    it('should validate progress values', () => {
      const taskId = 'test-task-validation';
      
      // Test invalid progress values
      expect(() => tracker.updateProgress(taskId, -1))
        .toThrow();
      expect(() => tracker.updateProgress(taskId, 101))
        .toThrow();
    });

    it('should calculate estimated completion time', () => {
      const taskId = 'test-task-2';
      
      // Simulate progress updates with time advancement
      jest.useFakeTimers();
      
      tracker.updateProgress(taskId, 25);
      jest.advanceTimersByTime(1000);
      tracker.updateProgress(taskId, 50);

      const progress = tracker.getProgress(taskId);
      expect(progress?.metrics.estimatedCompletion).toBeDefined();
      expect(progress?.metrics.estimatedCompletion.getTime()).toBeGreaterThan(Date.now());
      
      jest.useRealTimers();
    });

    it('should track resource metrics', () => {
      const taskId = 'test-task-3';
      const metrics = {
        cpuUsage: 45.5,
        memoryUsage: 1024 * 1024,
      };

      tracker.updateProgress(taskId, 30, metrics);

      const progress = tracker.getProgress(taskId);
      expect(progress?.metrics.cpuUsage).toBe(metrics.cpuUsage);
      expect(progress?.metrics.memoryUsage).toBe(metrics.memoryUsage);
    });

    it('should handle invalid resource metrics', () => {
      const taskId = 'test-task-invalid-metrics';
      const invalidMetrics = {
        cpuUsage: -1,  // Invalid CPU usage
        memoryUsage: -100,  // Invalid memory usage
      };

      expect(() => tracker.updateProgress(taskId, 50, invalidMetrics))
        .toThrow();
    });
  });

  describe('WebSocket Communication', () => {
    it('should send initial state to new clients', async () => {
      const taskId = 'test-task-4';
      tracker.updateProgress(taskId, 75);

      const newClient = new WebSocket(WS_URL);
      await waitForSocketState(newClient, WebSocket.OPEN);
      
      const message = await waitForMessage(newClient);
      expect(message.type).toBe('init');
      expect(message.data[taskId]).toBeDefined();
      expect(message.data[taskId].progress).toBe(75);

      newClient.close();
    });

    it('should broadcast progress updates to all clients', async () => {
      const taskId = 'test-task-5';
      let messageCount = 0;

      const messagePromises = [
        waitForMessage(wsClient),
        new Promise<any>((resolve) => {
          const secondClient = new WebSocket(WS_URL);
          secondClient.once('open', async () => {
            const message = await waitForMessage(secondClient);
            secondClient.close();
            resolve(message);
          });
        })
      ];

      tracker.updateProgress(taskId, 60);
      
      const messages = await Promise.all(messagePromises);
      messages.forEach(message => {
        expect(message.type).toBe('progress');
        expect(message.data.taskId).toBe(taskId);
        expect(message.data.progress).toBe(60);
      });
    });

    it('should handle WebSocket errors gracefully', (done) => {
      const errorClient = new WebSocket('ws://localhost:9999');  // Wrong port
      
      errorClient.once('error', (error) => {
        expect(error).toBeDefined();
        done();
      });
    });
  });

  describe('Progress Management', () => {
    it('should clear progress correctly', () => {
      const taskId = 'test-task-6';
      tracker.updateProgress(taskId, 80);
      tracker.clearProgress(taskId);

      const progress = tracker.getProgress(taskId);
      expect(progress).toBeNull();
    });

    it('should get all progress', () => {
      const tasks = [
        { id: 'task-1', progress: 25 },
        { id: 'task-2', progress: 50 },
        { id: 'task-3', progress: 75 },
      ];

      tasks.forEach(({ id, progress }) => {
        tracker.updateProgress(id, progress);
      });

      const allProgress = tracker.getAllProgress();
      expect(allProgress.length).toBe(tasks.length);
      tasks.forEach(({ id, progress }) => {
        const task = allProgress.find(t => t.taskId === id);
        expect(task?.progress).toBe(progress);
      });
    });

    it('should handle concurrent updates correctly', async () => {
      const taskId = 'concurrent-task';
      const updates = Array.from({ length: 10 }, (_, i) => i * 10);
      
      await Promise.all(
        updates.map(progress => 
          Promise.resolve(tracker.updateProgress(taskId, progress))
        )
      );

      const finalProgress = tracker.getProgress(taskId);
      expect(finalProgress?.progress).toBeLessThanOrEqual(90);
      expect(finalProgress?.progress).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid task IDs', () => {
      expect(() => tracker.updateProgress('', 50))
        .toThrow('Invalid task ID');
    });

    it('should handle server shutdown gracefully', async () => {
      const taskId = 'shutdown-test';
      tracker.updateProgress(taskId, 50);
      
      tracker.close();
      expect(tracker.getProgress(taskId)).toBeNull();
    });
  });
}); 