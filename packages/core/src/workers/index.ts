import { Worker as BullWorker, Job } from "bullmq";
import { WorkerConfig } from "../types/interfaces";
import { redisConnection } from "../config/redis";
import { ObserverEvent, TaskStatus } from "../types/enums";
import { TaskObserver } from "../observers/taskObserver";
import { logger } from "../utils/logger";
import { QueueManager } from "../queue/queueManager";

export class Worker extends BullWorker {
  private registeredTasks: Map<string, Function> = new Map();
  private observer: TaskObserver;
  private queueManager: QueueManager | null = null;

  constructor(
    queueName: string,
    config: WorkerConfig = {},
    instanceId: string = "default"
  ) {
    const redis = redisConnection.getInstance(instanceId);
    super(
      queueName,
      async (job: Job) => {
        const group = job.data.options?.group;
        // Check if task belongs to a group and if it's allowed to be processed
        if (group) {
          const canProcess = await this.canProcessGroupedTask(job);
          if (!canProcess) {
            logger.debug("⏳ Worker: Task waiting in group", {
              file: "worker/index.ts",
              line: 25,
              function: "processor",
              jobId: job.id,
              group: group,
            });
            // Delay the task and put it back in the queue
            await job.moveToDelayed(Date.now() + 1000);
            return null;
          }
        }

        const handler = this.registeredTasks.get(job.name);
        if (!handler) {
          throw new Error(`No handler registered for task ${job.name}`);
        }

        try {
          logger.debug("🚀 Worker: Processing task", {
            file: "worker/index.ts",
            line: 40,
            function: "processor",
            jobId: job.id,
            name: job.name,
            group: group,
            handler: handler.prototype,
            data: job.data.args ?? job.data,
          });

          let data = job.data.args ?? job.data;

          if (data.hasOwnProperty("data")) {
            data = data.data;
          }

          const result = await handler(...data);

          // If task belongs to a group, notify completion and process next task
          if (group && this.queueManager) {
            this.observer.notify(
              ObserverEvent.TASK_COMPLETED,
              job.id!,
              TaskStatus.COMPLETED,
              {
                data: {
                  group: group,
                  result,
                },
              }
            );
            
            await this.queueManager.completeGroupTask(
              job.id!,
              group
            );

            logger.debug("✅ Worker: Group task completed", {
              file: "worker/index.ts",
              line: 55,
              function: "processor",
              jobId: job.id,
              group: group,
            });
          }
        } catch (error) {
          console.log(error);
          logger.error("❌ Worker: Task processing failed", {
            file: "worker/index.ts",
            line: 65,
            function: "processor",
            jobId: job.id,
            error,
          });
          throw error;
        }
      },
      {
        connection: redis,
        ...config,
      }
    );

    this.observer = new TaskObserver(redis);
    this.setObservers(this.observer);
  }

  private async canProcessGroupedTask(job: Job): Promise<boolean> {
    if (!this.queueManager) return false;

    const group = job.data.options.group;
    
    try {
      const acquired = await this.queueManager.acquireGroupLock(
        group,
        job.id!,
        5000 // 5 second lock
      );

      if (!acquired) {
        return false;
      }

      try {
        const taskGroup = await this.queueManager.getGroup(group);
        const nextTask = await taskGroup.getNextTask();
        
        if (!nextTask) {
          return false;
        }

        const [nextTaskId, queueName] = nextTask;
        const canProcess = nextTaskId === job.id;

        if (!canProcess) {
          // Put task back if it's not next
          await taskGroup.addTask(
            job.name,
            job.data.options,
            job.data
          );
        }

        return canProcess;

      } finally {
        await this.queueManager.releaseGroupLock(group, job.id!);
      }

    } catch (error) {
      logger.error("❌ Worker: Failed to check group task status", {
        file: "worker/index.ts",
        function: "canProcessGroupedTask",
        error
      });
      return false;
    }
  }

  setQueueManager(queueManager: QueueManager): void {
    this.queueManager = queueManager;
  }

  getTaskHandler(taskId: string): Function | undefined {
    return this.registeredTasks.get(taskId);
  }

  setObservers(observer: TaskObserver): void {
    this.observer = observer;
    this.on("completed", async (job, result) => {
      this.observer.notify(
        ObserverEvent.TASK_COMPLETED,
        job!.id as string,
        TaskStatus.COMPLETED,
        {
          data: {
            group: job.data?.options?.group,
            result,
          },
        }
      );
    });

    this.on("failed", (job, result) => {
      this.observer.notify(
        ObserverEvent.TASK_FAILED,
        job!.id as string,
        TaskStatus.FAILED,
        result
      );
    });

    this.on("progress", (job, progress) => {
      this.observer.notify(
        ObserverEvent.TASK_PROGRESS,
        job.id as string,
        TaskStatus.ACTIVE,
        progress
      );
    });

    this.on("stalled", (job, result) => {
      this.observer.notify(
        ObserverEvent.TASK_STALLED,
        job! as string,
        TaskStatus.STALLED,
        result
      );
    });
  }

  registerTask(name: string, handler: Function): void {
    this.registeredTasks.set(name, handler);
  }

  getRegisteredTasks(): string[] {
    return Array.from(this.registeredTasks.keys());
  }
}
