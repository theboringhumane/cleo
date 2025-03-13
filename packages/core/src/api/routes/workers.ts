import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { logger } from "../../utils/logger";
import { Worker } from "../../types/interfaces";

interface WorkerParams {
  workerId: string;
}

interface WorkerQuerystring {
  queue?: string;
}

export default async function routes(fastify: FastifyInstance) {
  // @ts-expect-error - TODO: fix this
  const cleo = fastify.cleo;

  // Get all workers
  fastify.get(
    "/api/workers",
    async (request: FastifyRequest<{ Querystring: WorkerQuerystring }>, reply: FastifyReply) => {
      try {
        const { queue } = request.query;
        const queueManager = cleo.getQueueManager();
        const workerManager = cleo.getWorkerManager();
        const workers = queue 
          ? await queueManager.getQueueWorkers(queue)
          : await queueManager.getAllWorkers();

        const workersInfo = await Promise.all(workers.map(async (workerId: string) => {
          const status = await workerManager.getStatus(workerId);
          const activeTasks = await workerManager.getActiveTasks(workerId);
          const metrics = await workerManager.getMetrics(workerId);
          const lastHeartbeat = await workerManager.getLastHeartbeat(workerId);
          return {
            id: workerId,
            queue: queue,
            status,
            activeTasks,
            metrics: {
              tasksProcessed: metrics.tasksProcessed || 0,
              tasksSucceeded: metrics.tasksSucceeded || 0,
              tasksFailed: metrics.tasksFailed || 0,
              averageProcessingTime: metrics.averageProcessingTime || 0,
            },
            lastHeartbeat,
            isActive: status === "active",
          };
        }));

        logger.info("File: workers.ts 👥, Line: 31, Function: GET /api/workers;", {
          workersCount: workersInfo.length,
          queueFilter: queue,
        });

        return reply.send({ workers: workersInfo });
      } catch (error) {
        console.error(error);
        logger.error("File: workers.ts ❌, Line: 38, Function: GET /api/workers;", {
          error,
        });
        return reply.status(500).send({ error: "Failed to fetch workers" });
      }
    }
  );

  // Get specific worker
  fastify.get<{ Params: WorkerParams }>(
    "/api/workers/:workerId",
    async (request, reply) => {
      try {
        const { workerId } = request.params;
        const workerManager = cleo.getWorkerManager();

        const status = await workerManager.getStatus(workerId);
        const workerQueue = await workerManager.getWorkerQueue(workerId);
        const activeTasks = await workerManager.getActiveTasks(workerId);
        const taskHistory = await workerManager.getTaskHistory(workerId);
        const lastHeartbeat = await workerManager.getLastHeartbeat(workerId);
        const metrics = await workerManager.getMetrics(workerId);
        
        const workerInfo: Worker = {
          id: workerId,
          queue: workerQueue,
          status,
          activeTasks,
          lastHeartbeat,
          isActive: status === "active",
          metrics,
          history: taskHistory
        };

        logger.info("File: workers.ts 👤, Line: 55, Function: GET /api/workers/:workerId;", {
          workerId,
        });

        return reply.send(workerInfo);
      } catch (error) {
        console.error(error);
        logger.error("File: workers.ts ❌, Line: 62, Function: GET /api/workers/:workerId;", {
          error,
        });
        return reply.status(500).send({ error: "Failed to fetch worker" });
      }
    }
  );

  // Get worker metrics
  fastify.get<{ Params: WorkerParams }>(
    "/api/workers/:workerId/metrics",
    async (request, reply) => {
      try {
        const { workerId } = request.params;
        const workerManager = cleo.getWorkerManager();

        const metrics = await workerManager.getMetrics(workerId);
        const history = await workerManager.getMetricsHistory(workerId);

        logger.info("File: workers.ts 📊, Line: 149, Function: GET /api/workers/:workerId/metrics;", {
          workerId,
        });

        return reply.send({
          current: metrics,
          history
        });
      } catch (error) {
        console.error(error);
        logger.error("File: workers.ts ❌, Line: 172, Function: GET /api/workers/:workerId/metrics;", {
          error,
        });
        return reply.status(500).send({ error: "Failed to fetch worker metrics" });
      }
    }
  );
}