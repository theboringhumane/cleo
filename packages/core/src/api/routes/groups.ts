import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { TaskOptions } from "../../index";
import { logger } from "../../utils/logger";

interface GroupTaskBody {
  methodName: string;
  data: any;
  options: TaskOptions;
}

interface GroupParams {
  groupName: string;
}

interface TaskParams {
  taskId: string;
}

interface GroupPriorityBody {
  priority: number;
}

export default async function routes(fastify: FastifyInstance) {
  // @ts-expect-error - TODO: fix this
  const cleo = fastify.cleo;

  // Get all groups
  fastify.get(
    "/api/groups",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const queueManager = cleo.getQueueManager();
        const groups = await queueManager.getAllGroups();

        logger.info("File: groups.ts 📋, Line: 31, Function: GET /api/groups;", {
          groupsCount: groups.length,
        });

        return reply.send({ groups });
      } catch (error) {
        logger.error("File: groups.ts ❌, Line: 38, Function: GET /api/groups;", {
          error,
        });
        return reply.status(500).send({ error: "Failed to fetch groups" });
      }
    }
  );

  // Get tasks for a specific group
  fastify.get<{ Params: GroupParams }>(
    "/api/groups/:groupName/tasks",
    async (request, reply) => {
      try {
        const { groupName } = request.params;
        const queueManager = cleo.getQueueManager();
        const tasks = await queueManager.getGroupTasks(groupName);

        logger.info("File: groups.ts 📋, Line: 55, Function: GET /api/groups/:groupName/tasks;", {
          groupName,
          tasksCount: tasks.length,
        });

        return reply.send({ tasks });
      } catch (error) {
        logger.error("File: groups.ts ❌, Line: 62, Function: GET /api/groups/:groupName/tasks;", {
          error,
        });
        return reply.status(500).send({ error: "Failed to fetch group tasks" });
      }
    }
  );

  // Add task to group
  fastify.post<{ Body: GroupTaskBody; Params: GroupParams }>(
    "/api/groups/:groupName/tasks",
    async (request, reply) => {
      try {
        const { groupName } = request.params;
        const { methodName, data, options } = request.body;
        
        // Ensure the group name in the URL matches the one in options
        options.group = groupName;
        
        const queueManager = cleo.getQueueManager();
        await queueManager.addTaskToGroup(methodName, options, data);

        logger.info("File: groups.ts ➕, Line: 84, Function: POST /api/groups/:groupName/tasks;", {
          groupName,
          methodName,
        });

        return reply.send({ message: "Task added to group successfully" });
      } catch (error) {
        logger.error("File: groups.ts ❌, Line: 91, Function: POST /api/groups/:groupName/tasks;", {
          error,
        });
        return reply.status(500).send({ error: "Failed to add task to group" });
      }
    }
  );

  // Set group priority
  fastify.put<{ Body: GroupPriorityBody; Params: GroupParams }>(
    "/api/groups/:groupName/priority",
    async (request, reply) => {
      try {
        const { groupName } = request.params;
        const { priority } = request.body;
        const queueManager = cleo.getQueueManager();
        
        await queueManager.setGroupPriority(groupName, priority);

        logger.info("File: groups.ts 🔄, Line: 109, Function: PUT /api/groups/:groupName/priority;", {
          groupName,
          priority,
        });

        return reply.send({ message: "Group priority updated successfully" });
      } catch (error) {
        logger.error("File: groups.ts ❌, Line: 116, Function: PUT /api/groups/:groupName/priority;", {
          error,
        });
        return reply.status(500).send({ error: "Failed to update group priority" });
      }
    }
  );

  // Get group stats
  fastify.get<{ Params: GroupParams }>(
    "/api/groups/:groupName/stats",
    async (request, reply) => {
      try {
        const { groupName } = request.params;
        const queueManager = cleo.getQueueManager();
        const group = await queueManager.getGroup(groupName);
        const stats = await group.getStats();

        logger.info("File: groups.ts 📊, Line: 134, Function: GET /api/groups/:groupName/stats;", {
          groupName,
          stats,
        });

        return reply.send({ stats });
      } catch (error) {
        logger.error("File: groups.ts ❌, Line: 141, Function: GET /api/groups/:groupName/stats;", {
          error,
        });
        return reply.status(500).send({ error: "Failed to fetch group stats" });
      }
    }
  );
} 