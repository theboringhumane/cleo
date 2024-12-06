import { Worker as BullWorker, Job } from 'bullmq';
import { TaskRegistry } from './taskRegistry';
import { WorkerConfig, Task } from '../types/interfaces';
import { TaskState, WorkerState } from '../types/enums';
import { logger } from '../utils/logger';
import { redisConnection } from '../config/redis';

export class Worker {
  private worker: BullWorker;
  private registry: TaskRegistry;
  private state: WorkerState = WorkerState.IDLE;

  constructor(queueName: string, config: WorkerConfig) {
    logger.info('File: worker.ts 🚀, Line: 14, Function: constructor;', {
      queueName,
      config
    });

    this.registry = new TaskRegistry();
    this.worker = new BullWorker(queueName, this.processTask.bind(this), {
      connection: redisConnection,
      concurrency: config.concurrency || 1,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.worker.on('completed', (job: Job) => {
      if (job) {
        logger.info('File: worker.ts ✅, Line: 29, Function: setupEventHandlers;', {
          jobId: job.id,
          state: TaskState.SUCCESS
        });
      }
    });

    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      logger.error('File: worker.ts ❌, Line: 36, Function: setupEventHandlers;', {
        jobId: job?.id,
        error,
        state: TaskState.FAILURE
      });
    });

    this.worker.on('error', (error: Error) => {
      logger.error('File: worker.ts 💥, Line: 44, Function: setupEventHandlers;', {
        error,
        state: WorkerState.ERROR
      });
      this.state = WorkerState.ERROR;
    });
  }

  private async processTask(job: Job): Promise<any> {
    try {
      logger.info('File: worker.ts 🔄, Line: 54, Function: processTask;', {
        jobId: job.id,
        state: TaskState.RUNNING
      });

      this.state = WorkerState.BUSY;
      const task = job.data as Task;
      const handler = this.registry.getTaskHandler(task.name);

      if (!handler) {
        throw new Error(`No handler registered for task: ${task.name}`);
      }

      const result = await handler(task.data);
      this.state = WorkerState.IDLE;

      logger.info('File: worker.ts ✅, Line: 69, Function: processTask;', {
        jobId: job.id,
        taskName: task.name,
        result
      });

      return result;
    } catch (error) {
      this.state = WorkerState.ERROR;
      logger.error('File: worker.ts ❌, Line: 78, Function: processTask;', {
        jobId: job.id,
        error
      });
      throw error;
    }
  }

  registerTask(name: string, handler: Function): void {
    this.registry.registerTask(name, handler);
  }

  getState(): WorkerState {
    return this.state;
  }

  async close(): Promise<void> {
    logger.info('File: worker.ts 🔒, Line: 90, Function: close;', {
      state: WorkerState.STOPPED
    });

    this.state = WorkerState.STOPPED;
    await this.worker.close();
  }
} 