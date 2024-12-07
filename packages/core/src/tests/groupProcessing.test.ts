import Redis from "ioredis-mock";
import type { Redis as RedisType } from "ioredis";
import { QueueManager } from "../queue/queueManager";
import { GroupProcessingStrategy } from "../types/enums";
import type { Task } from "../types/interfaces";

describe("Group Processing", () => {
  let redis: RedisType;
  let queueManager: QueueManager;

  beforeEach(() => {
    redis = new Redis() as unknown as RedisType;
    queueManager = new QueueManager("test-queue");
  });

  describe("Round Robin Strategy", () => {
    beforeEach(() => {
      queueManager.setGroupProcessingStrategy(
        GroupProcessingStrategy.ROUND_ROBIN
      );
    });

    test("should process tasks in round-robin order across groups", async () => {
      const processedTasks: string[] = [];

      // Create tasks with group information
      await queueManager.addTask(
        "test-task",
        { data: "test" },
        {
          id: "task1-user1",
          group: "user1",
        }
      );
      await queueManager.addTask(
        "test-task",
        { data: "test" },
        {
          id: "task2-user1",
          group: "user1",
        }
      );
      // ... add other tasks ...

      // Add tasks to groups
      await queueManager.addTaskToGroup("task1-user1", "user1");
      await queueManager.addTaskToGroup("task2-user1", "user1");
      await queueManager.addTaskToGroup("task1-user2", "user2");
      await queueManager.addTaskToGroup("task2-user2", "user2");

      // Process tasks
      const processor = async (task: Task) => {
        processedTasks.push(task.id);
      };

      // Process 4 tasks
      for (let i = 0; i < 4; i++) {
        const task = await queueManager.getNextGroupTask();
        if (task && task.group) {
          await processor(task);
          const group = await queueManager.getGroup(task.group);
          await group.completeTask(task.id);
        }
      }

      // Verify round-robin order
      expect(processedTasks).toEqual([
        "task1-user1",
        "task1-user2",
        "task2-user1",
        "task2-user2",
      ]);
    });
  });

  describe("FIFO Strategy", () => {
    beforeEach(() => {
      queueManager.setGroupProcessingStrategy(GroupProcessingStrategy.FIFO);
    });

    test("should process all tasks from first group before moving to next", async () => {
      const processedTasks: string[] = [];

      // Create and add tasks
      await queueManager.addTask(
        "test-task",
        { data: "test" },
        {
          id: "task1-group1",
          group: "group1",
        }
      );
      await queueManager.addTask(
        "test-task",
        { data: "test" },
        {
          id: "task2-group1",
          group: "group1",
        }
      );
      await queueManager.addTask(
        "test-task",
        { data: "test" },
        {
          id: "task1-group2",
          group: "group2",
        }
      );

      // Add to groups
      await queueManager.addTaskToGroup("task1-group1", "group1");
      await queueManager.addTaskToGroup("task2-group1", "group1");
      await queueManager.addTaskToGroup("task1-group2", "group2");

      // Process tasks
      for (let i = 0; i < 3; i++) {
        const task = await queueManager.getNextGroupTask();
        if (task && task.group) {
          processedTasks.push(task.id);
          const group = await queueManager.getGroup(task.group);
          await group.completeTask(task.id);
        }
      }

      expect(processedTasks).toEqual([
        "task1-group1",
        "task2-group1",
        "task1-group2",
      ]);
    });
  });

  describe("Priority Strategy", () => {
    beforeEach(() => {
      queueManager.setGroupProcessingStrategy(GroupProcessingStrategy.PRIORITY);
    });

    test("should process tasks from high priority groups first", async () => {
      const processedTasks: string[] = [];

      // Create groups with different priorities
      await queueManager.addTask(
        "test-task",
        { data: "test" },
        {
          id: "task1-low",
          group: "low-priority",
        }
      );
      await queueManager.addTask(
        "test-task",
        { data: "test" },
        {
          id: "task1-high",
          group: "high-priority",
        }
      );

      await queueManager.addTaskToGroup("task1-low", "low-priority");
      await queueManager.addTaskToGroup("task1-high", "high-priority");

      // Set priorities
      await queueManager.setGroupPriority("low-priority", 1);
      await queueManager.setGroupPriority("high-priority", 10);

      // Process tasks
      for (let i = 0; i < 2; i++) {
        const task = await queueManager.getNextGroupTask();
        if (task && task.group) {
          processedTasks.push(task.id);
          const group = await queueManager.getGroup(task.group);
          await group.completeTask(task.id);
        }
      }

      expect(processedTasks).toEqual([
        "task1-high", // High priority processed first
        "task1-low",
      ]);
    });
  });
});
