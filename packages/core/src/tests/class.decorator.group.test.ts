import { QueueClass } from "../decorators/class";
import { TaskPriority } from "../types/enums";
import { Cleo } from "../index";
import type { Task } from "../types/interfaces";

const cleo = Cleo.getInstance();

describe("QueueClass Decorator - Task Grouping", () => {
  beforeAll(() => {
    // Configure cleo for testing
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

  test("should automatically group tasks using class name when no group specified", async () => {
    @QueueClass()
    class AutoGroupService {
      async method1(data: string) {
        return `processed ${data}`;
      }

      async method2(data: string) {
        return `validated ${data}`;
      }
    }

    const service = new AutoGroupService();
    const queueManager = cleo.getQueueManager();

    await service.method1("test1");
    await service.method2("test2");

    const tasks = await queueManager.getAllTasks();
    expect(tasks.length).toBe(2);
    tasks.forEach((task: Task) => {
      expect(task.options.group).toBe("AutoGroupService");
    });
  });

  test("should use custom group name when specified in options", async () => {
    @QueueClass({
      group: "customGroup",
      defaultOptions: {
        priority: TaskPriority.HIGH,
      },
    })
    class CustomGroupService {
      async task1(data: string) {
        return `task1 ${data}`;
      }

      async task2(data: string) {
        return `task2 ${data}`;
      }
    }

    const service = new CustomGroupService();
    const queueManager = cleo.getQueueManager();

    await service.task1("test1");
    await service.task2("test2");

    const tasks = await queueManager.getAllTasks();
    expect(tasks.length).toBe(2);
    tasks.forEach((task: Task) => {
      expect(task.options.group).toBe("customGroup");
    });
  });

  test("should preserve group name across inherited classes", async () => {
    @QueueClass({
      group: "baseGroup",
      includeInherited: true,
    })
    class BaseService {
      async baseMethod() {
        return "base";
      }
    }

    class DerivedService extends BaseService {
      async derivedMethod() {
        return "derived";
      }
    }

    const service = new DerivedService();
    const queueManager = cleo.getQueueManager();

    await service.baseMethod();
    await service.derivedMethod();

    const tasks = await queueManager.getAllTasks();
    expect(tasks.length).toBe(2);
    tasks.forEach((task: Task) => {
      expect(task.options.group).toBe("baseGroup");
    });
  });

  test("should allow mixing tasks from different groups", async () => {
    @QueueClass({ group: "group1" })
    class Service1 {
      async task() {
        return "service1";
      }
    }

    @QueueClass({ group: "group2" })
    class Service2 {
      async task() {
        return "service2";
      }
    }

    const service1 = new Service1();
    const service2 = new Service2();
    const queueManager = cleo.getQueueManager();

    await service1.task();
    await service2.task();

    const tasks = await queueManager.getAllTasks();
    expect(tasks.length).toBe(2);

    // Group the tasks by their group name
    const tasksByGroup = tasks.reduce((acc, task: Task) => {
      const group = task.options.group;
      if (group) {
        if (!acc[group]) acc[group] = [];
        acc[group].push(task);
      }
      return acc;
    }, {} as Record<string, Task[]>);

    expect(Object.keys(tasksByGroup).length).toBe(2);
    expect(tasksByGroup["group1"].length).toBe(1);
    expect(tasksByGroup["group2"].length).toBe(1);

    // Test getting tasks by group
    const group1 = await queueManager.getGroup("group1");
    const group2 = await queueManager.getGroup("group2");

    const group1Tasks = await group1.getTasks();
    const group2Tasks = await group2.getTasks();

    expect(group1Tasks.length).toBe(1);
    expect(group2Tasks.length).toBe(1);
    expect(group1Tasks[0].options.group).toBe("group1");
    expect(group2Tasks[0].options.group).toBe("group2");
  });
}); 