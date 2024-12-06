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

export default async function routes(fastify: FastifyInstance) {
  // @ts-expect-error - TODO: fix this
  const cleo = fastify.cleo;
  // Get all tasks
  fastify.get(
    "/api/queues",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const queueManager = cleo.getQueueManager();
        const tasks = await queueManager.getAllTasks();

        logger.info(
          "File: queues.ts 📋, Line: 13, Function: GET /api/Queues;",
          {
            tasksCount: tasks.length,
          }
        );

        return reply.send({ tasks });
      } catch (error) {
        logger.error(
          "File: queues.ts ❌, Line: 19, Function: GET /api/queues;",
          {
            error,
          }
        );
        return reply.status(500).send({ error: "Failed to fetch tasks" });
      }
    }
  );

  // Add new task
  fastify.post<{ Body: TaskBody }>("/api/queues", async (request, reply) => {
    try {
      const { name, data, options } = request.body;
      const queueManager = cleo.getQueueManager();
      const task = await queueManager.addTask(name, data, options);

      logger.info("File: queues.ts ➕, Line: 31, Function: POST /api/queues;", {
        taskId: task.id,
        taskName: task.name,
      });

      return reply.send(task);
    } catch (error) {
      logger.error(
        "File: queues.ts ❌, Line: 38, Function: POST /api/queues;",
        {
          error,
        }
      );
      return reply.status(500).send({ error: "Failed to create task" });
    }
  });

  // Delete task
  fastify.delete<{ Params: TaskParams }>(
    "/api/queues/:taskId",
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
