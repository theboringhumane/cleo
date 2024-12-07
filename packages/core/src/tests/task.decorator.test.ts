import { task } from "../decorators/task";
import { TaskPriority } from "../types/enums";
import { Cleo } from "..";
import type { Task } from "../types/interfaces";

const cleo = Cleo.getInstance();

describe("Task Decorator", () => {
  beforeAll(() => {
    cleo.configure({
      redis: {
        host: "localhost",
        port: 6379,
        password: "cleosecret",
      },
    });
  });

  beforeEach(async () => {
    // Clear all tasks before each test
    const queueManager = cleo.getQueueManager();
    const tasks = await queueManager.getAllTasks();
    await Promise.all(tasks.map(task => queueManager.removeTask(task.id)));
  });

  test("should preserve method execution context", async () => {
    class TestService {
      private prefix: string = "test";

      @task()
      async processWithContext(data: string): Promise<string> {
        return `${this.prefix}-${data}`;
      }
    }

    const service = new TestService();
    const result = await service.processWithContext("data");

    expect(result).toBe("test-data");

    const tasks = await cleo.getQueueManager().getAllTasks();
    expect(tasks[0].data.result).toBe("test-data");
  });

  test("should handle errors properly", async () => {
    class TestService {
      @task()
      async failingMethod(): Promise<void> {
        throw new Error("Test error");
      }
    }

    const service = new TestService();
    await expect(service.failingMethod()).rejects.toThrow("Test error");

    const worker = cleo.getWorker('default');
    expect(worker?.getRegisteredTasks()).toContain("failingMethod");

    const tasks = await cleo.getQueueManager().getAllTasks();
    expect(tasks.length).toBe(1);
    expect(tasks[0].name).toBe("failingMethod");
  });

  test("should create and add task to group", async () => {
    class TestService {
      @task({ group: "testGroup" })
      async groupedTask(data: string): Promise<string> {
        return `processed-${data}`;
      }
    }

    const service = new TestService();
    const queueManager = cleo.getQueueManager();

    await service.groupedTask("test-data");

    const tasks = await queueManager.getAllTasks();
    expect(tasks.length).toBe(1);
    expect(tasks[0].options.group).toBe("testGroup");

    // Verify group was created and contains the task
    const group = await queueManager.getGroup("testGroup");
    const groupTasks = await group.getTasks();
    expect(groupTasks.length).toBe(1);
    expect(groupTasks[0].options.group).toBe("testGroup");
  });

  test("should allow multiple tasks in same group", async () => {
    class TestService {
      @task({ group: "multiGroup" })
      async task1(data: string): Promise<string> {
        return `task1-${data}`;
      }

      @task({ group: "multiGroup" })
      async task2(data: string): Promise<string> {
        return `task2-${data}`;
      }
    }

    const service = new TestService();
    const queueManager = cleo.getQueueManager();

    await service.task1("data1");
    await service.task2("data2");

    const tasks = await queueManager.getAllTasks();
    expect(tasks.length).toBe(2);
    tasks.forEach((task: Task) => {
      expect(task.options.group).toBe("multiGroup");
    });

    // Verify all tasks are in the group
    const group = await queueManager.getGroup("multiGroup");
    const groupTasks = await group.getTasks();
    expect(groupTasks.length).toBe(2);
    expect(groupTasks.map(t => t.name)).toContain("task1");
    expect(groupTasks.map(t => t.name)).toContain("task2");
  });

  test("should handle tasks with different groups", async () => {
    class TestService {
      @task({ group: "group1" })
      async task1(): Promise<string> {
        return "task1";
      }

      @task({ group: "group2" })
      async task2(): Promise<string> {
        return "task2";
      }

      @task() // No group
      async task3(): Promise<string> {
        return "task3";
      }
    }

    const service = new TestService();
    const queueManager = cleo.getQueueManager();

    await service.task1();
    await service.task2();
    await service.task3();

    const tasks = await queueManager.getAllTasks();
    expect(tasks.length).toBe(3);

    // Group tasks by their group
    const tasksByGroup = tasks.reduce((acc, task: Task) => {
      const group = task.options.group;
      if (group) {
        if (!acc[group]) acc[group] = [];
        acc[group].push(task);
      } else {
        if (!acc["ungrouped"]) acc["ungrouped"] = [];
        acc["ungrouped"].push(task);
      }
      return acc;
    }, {} as Record<string, Task[]>);

    expect(tasksByGroup["group1"].length).toBe(1);
    expect(tasksByGroup["group2"].length).toBe(1);
    expect(tasksByGroup["ungrouped"].length).toBe(1);

    // Verify tasks in each group
    const group1 = await queueManager.getGroup("group1");
    const group2 = await queueManager.getGroup("group2");

    const group1Tasks = await group1.getTasks();
    const group2Tasks = await group2.getTasks();

    expect(group1Tasks.length).toBe(1);
    expect(group2Tasks.length).toBe(1);
    expect(group1Tasks[0].name).toBe("task1");
    expect(group2Tasks[0].name).toBe("task2");
  });
}); 