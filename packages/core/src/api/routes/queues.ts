import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { TaskOptions } from "../../index";
import { logger } from "../../utils/logger";

interface TaskBody {
  name: string;
  data: any;
  options: TaskOptions;
}

interface TaskParams {
  taskId: string;
}

interface MetricsParams {
  queueName: string;
}

interface MetricsQuerystring {
  start?: number;
  end?: number;
}

interface QueueParams {
  queueName: string;
}

interface TaskHistoryEvent {
  timestamp: number;
  state: string;
  data: any;
}

export default async function routes(fastify: FastifyInstance) {
  // @ts-expect-error - TODO: fix this
  const cleo = fastify.cleo;

  // Get all queues with their tasks
  fastify.get(
    "/api/queues/get-all",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const queueManager = cleo.getQueueManager();
        const queues = await queueManager.getQueues();

        console.log("📋 QueueManager: Getting all queues", {
          file: "queues.ts",
          function: "getQueues",
          queues,
        });

        const queuePromises = queues.map(async (queueName: string) => {
          const metrics = await queueManager.getQueueMetrics(queueName);
          const tasks = await queueManager.getQueueTasks(queueName);
          return {
            name: queueName,
            metrics: {
              active: metrics.active || 0,
              waiting: metrics.waiting || 0,
              completed: metrics.completed || 0,
              failed: metrics.failed || 0,
            },
            tasks,
          };
        });

        const queuesWithMetrics = await Promise.all(queuePromises);

        logger.info(
          "File: queues.ts 📋, Line: 31, Function: GET /api/queues/get-all;",
          {
            queuesCount: queues.length,
          }
        );

        return reply.send({ queues: queuesWithMetrics });
      } catch (error) {
        logger.error(
          "File: queues.ts ❌, Line: 38, Function: GET /api/queues/get-all;",
          {
            error,
          }
        );
        return reply.status(500).send({ error: "Failed to fetch queues" });
      }
    }
  );

  // Get specific queue data
  fastify.get<{ Params: QueueParams }>(
    "/api/queues/get-by-name/:queueName",
    async (request, reply) => {
      try {
        const { queueName } = request.params;
        const queueManager = cleo.getQueueManager();
        const tasks = await queueManager.getQueueTasks(queueName);
        const metrics = await queueManager.getQueueMetrics(queueName);

        logger.info(
          "File: queues.ts 📋, Line: 55, Function: GET /api/queues/:queueName;",
          {
            queueName,
            tasksCount: tasks.length,
          }
        );

        return reply.send({
          tasks,
          metrics,
          name: queueName,
        });
      } catch (error) {
        console.log(error);
        logger.error(
          "File: queues.ts ❌, Line: 62, Function: GET /api/queues/:queueName;",
          {
            error,
          }
        );
        return reply.status(500).send({ error: "Failed to fetch queue data" });
      }
    }
  );

  // Get metrics for all queues
  fastify.get(
    "/api/queues/metrics",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const queueManager = cleo.getQueueManager();
        const queues = await queueManager.getAllQueueMetrics();
        logger.info(
          "File: queues.ts 📊, Line: 31, Function: GET /api/queues/metrics;",
          {
            queuesCount: queues.length,
          }
        );

        return reply.send({ metrics: queues });
      } catch (error) {
        logger.error(
          "File: queues.ts ❌, Line: 37, Function: GET /api/queues/metrics;",
          {
            error,
          }
        );
        return reply
          .status(500)
          .send({ error: "Failed to fetch queue metrics" });
      }
    }
  );

  // Get metrics for a specific queue
  fastify.get<{
    Params: MetricsParams;
    Querystring: MetricsQuerystring;
  }>("/api/queues/:queueName/metrics", async (request, reply) => {
    try {
      const { queueName } = request.params;
      const { start, end } = request.query;
      const queueManager = cleo.getQueueManager();

      let metrics;
      if (start || end) {
        metrics = await queueManager.getQueueMetrics(queueName, { start, end });
      } else {
        metrics = await queueManager.getLatestQueueMetrics(queueName);
      }

      if (!metrics) {
        return reply.status(404).send({ error: "Queue metrics not found" });
      }

      // Transform metrics into the expected format
      const formattedMetrics = Array.isArray(metrics) ? metrics : [metrics];
      const transformedMetrics = formattedMetrics.map((metric) => ({
        timestamp: new Date().toISOString(),
        active: metric.active || 0,
        waiting: metric.waiting || 0,
        completed: metric.completed || 0,
        failed: metric.failed || 0,
      }));

      logger.info(
        "File: queues.ts 📊, Line: 65, Function: GET /api/queues/:queueName/metrics;",
        {
          queueName,
          hasMetrics: !!metrics,
        }
      );

      return reply.send({ metrics: transformedMetrics });
    } catch (error) {
      console.log(error);
      logger.error(
        "File: queues.ts ❌, Line: 72, Function: GET /api/queues/:queueName/metrics;",
        {
          error,
        }
      );
      return reply.status(500).send({ error: "Failed to fetch queue metrics" });
    }
  });

  // Get specific task
  fastify.get<{ Params: TaskParams }>(
    "/api/queues/get-task/:taskId",
    async (request, reply) => {
      try {
        const { taskId } = request.params;
        const queueManager = cleo.getQueueManager();
        const task = await queueManager.getTask(taskId);

        if (!task) {
          return reply.status(404).send({ error: "Task not found" });
        }

        // Get task history
        const history = await queueManager.getTaskHistory(taskId);
        const formattedHistory = history.map((event: TaskHistoryEvent) => ({
          timestamp: new Date(event.timestamp).toISOString(),
          state: event.state,
          data: event.data,
        }));

        return reply.send({
          task,
          history: formattedHistory,
        });
      } catch (error) {
        logger.error(
          "File: queues.ts ❌, Line: 100, Function: GET /api/queues/get-task/:taskId;",
          {
            error,
          }
        );
        return reply.status(500).send({ error: "Failed to fetch task" });
      }
    }
  );

  // Add new task
  fastify.post<{ Body: TaskBody }>(
    "/api/queues/add-task",
    async (request, reply) => {
      try {
        const { name, data, options } = request.body;
        const queueManager = cleo.getQueueManager();
        const task = await queueManager.addTask(name, data, options);

        logger.info(
          "File: queues.ts ➕, Line: 31, Function: POST /api/queues/add-task;",
          {
            taskId: task.id,
            taskName: task.name,
          }
        );

        return reply.send(task);
      } catch (error) {
        console.log(error);
        logger.error(
          "File: queues.ts ❌, Line: 38, Function: POST /api/queues/add-task;",
          {
            error,
          }
        );
        return reply.status(500).send({ error: "Failed to create task" });
      }
    }
  );

  // Delete task
  fastify.delete<{ Params: TaskParams }>(
    "/api/queues/remove-task/:taskId",
    async (request, reply) => {
      try {
        const { taskId } = request.params;
        const queueManager = cleo.getQueueManager();
        const success = await queueManager.removeTask(taskId);

        if (success) {
          logger.info(
            "File: queues.ts 🗑️, Line: 51, Function: DELETE /api/queues/:taskId;",
            {
              taskId,
            }
          );
          return reply.send({ message: "Task removed successfully" });
        } else {
          logger.warn(
            "File: queues.ts ⚠️, Line: 55, Function: DELETE /api/queues/:taskId;",
            {
              taskId,
              message: "Task not found",
            }
          );
          return reply.status(404).send({ error: "Task not found" });
        }
      } catch (error) {
        logger.error(
          "File: queues.ts ❌, Line: 62, Function: DELETE /api/queues/:taskId;",
          {
            error,
          }
        );
        return reply.status(500).send({ error: "Failed to remove task" });
      }
    }
  );
}
