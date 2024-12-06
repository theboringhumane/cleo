import { WebSocket, WebSocketServer } from 'ws';
import { Task, TaskProgress } from '../types/interfaces';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export class ProgressTracker extends EventEmitter {
  private wss: WebSocketServer;
  private clients: Set<WebSocket>;
  private taskProgress: Map<string, TaskProgress>;
  private metrics: Map<string, {
    startTime: Date;
    cpuUsage: number;
    memoryUsage: number;
  }>;

  constructor(port: number = 3001) {
    super();
    this.wss = new WebSocketServer({ port });
    this.clients = new Set();
    this.taskProgress = new Map();
    this.metrics = new Map();

    this.setupWebSocket();
    logger.info('File: progressTracker.ts', '🔌', '20', 'constructor', 'port', 
      `Progress tracker WebSocket server started on port ${port}`);
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      
      // Send current state to new client
      const currentState = Array.from(this.taskProgress.entries());
      ws.send(JSON.stringify({ type: 'init', data: currentState }));

      ws.on('close', () => {
        this.clients.delete(ws);
      });
    });
  }

  updateProgress(taskId: string, progress: number, metrics?: {
    cpuUsage?: number;
    memoryUsage?: number;
  }): void {
    if (!taskId) {
      logger.error('File: progressTracker.ts', '🔌', '20', 'updateProgress', 'taskId', 'Invalid task ID');
      throw new Error('Invalid task ID');
    }

    const taskMetrics = this.metrics.get(taskId) || {
      startTime: new Date(),
      cpuUsage: 0,
      memoryUsage: 0,
    };

    if (metrics) {
      taskMetrics.cpuUsage = metrics.cpuUsage || taskMetrics.cpuUsage;
      taskMetrics.memoryUsage = metrics.memoryUsage || taskMetrics.memoryUsage;
    }

    const progressData: TaskProgress = {
      taskId,
      progress,
      metrics: {
        startTime: taskMetrics.startTime,
        estimatedCompletion: this.calculateEstimatedCompletion(taskId, progress),
        cpuUsage: taskMetrics.cpuUsage,
        memoryUsage: taskMetrics.memoryUsage,
      },
    };

    this.taskProgress.set(taskId, progressData);
    this.metrics.set(taskId, taskMetrics);

    // Broadcast progress update to all connected clients
    this.broadcast({
      type: 'progress',
      data: progressData,
    });

    this.emit('progress', progressData);
  }

  private calculateEstimatedCompletion(taskId: string, currentProgress: number): Date {
    const metrics = this.metrics.get(taskId);
    if (!metrics || currentProgress === 0) {
      return new Date();
    }

    const elapsed = Date.now() - metrics.startTime.getTime();
    const estimatedTotal = (elapsed / currentProgress) * 100;
    const remaining = estimatedTotal - elapsed;

    return new Date(Date.now() + remaining);
  }

  private broadcast(message: any): void {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  getProgress(taskId: string): TaskProgress | null {
    return this.taskProgress.get(taskId) || null;
  }

  getAllProgress(): TaskProgress[] {
    return Array.from(this.taskProgress.values());
  }

  clearProgress(taskId: string): void {
    this.taskProgress.delete(taskId);
    this.metrics.delete(taskId);
    this.broadcast({
      type: 'clear',
      data: { taskId },
    });
  }

  close(): void {
    this.wss.close();
    this.clients.clear();
    this.taskProgress.clear();
    this.metrics.clear();
  }
} 