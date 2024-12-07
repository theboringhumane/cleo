import { QueueClass } from "../decorators/class";
import { TaskOptions } from "../types/interfaces";
import { TaskPriority } from "../types/enums";
import { Cleo } from "../index";

const cleo = Cleo.getInstance();

describe("QueueClass Decorator", () => {
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

  test("should decorate all methods in a class", async () => {
    @QueueClass()
    class TestService {
      async processData(data: string) {
        return `processed ${data}`;
      }

      async validateData(data: string) {
        return `validated ${data}`;
      }
    }

    const service = new TestService();
    const queueManager = cleo.getQueueManager();

    // Both methods should be queued
    await service.processData("test");
    await service.validateData("test");

    const tasks = await queueManager.getAllTasks();
    expect(tasks.length).toBe(2);
    expect(tasks[0].name).toBe("processData");
    expect(tasks[1].name).toBe("validateData");
  });

  test("should respect include/exclude options", async () => {
    @QueueClass({
      include: ["processData"],
    })
    class TestService {
      async processData(data: string) {
        return `processed ${data}`;
      }

      async validateData(data: string) {
        return `validated ${data}`;
      }
    }

    const service = new TestService();
    const queueManager = cleo.getQueueManager();

    // Only processData should be queued
    await service.processData("test");
    await service.validateData("test");

    const tasks = await queueManager.getAllTasks();
    expect(tasks.length).toBe(1);
    expect(tasks[0].name).toBe("processData");
  });

  test("should apply default options to all methods", async () => {
    const defaultOptions: TaskOptions = {
      priority: TaskPriority.HIGH,
      queue: "test-queue",
    };

    @QueueClass({
      defaultOptions,
    })
    class TestService {
      async processData(data: string) {
        return `processed ${data}`;
      }
    }

    const service = new TestService();
    const queueManager = cleo.getQueueManager();

    await service.processData("test");

    const tasks = await queueManager.getAllTasks();
    expect(tasks[0].options.priority).toBe(TaskPriority.HIGH);
    expect(tasks[0].options.queue).toBe("test-queue");
  });

  test("should handle inherited methods", async () => {
    class BaseService {
      async baseMethod() {
        return "base";
      }
    }

    @QueueClass({
      includeInherited: true,
    })
    class TestService extends BaseService {
      async childMethod() {
        return "child";
      }
    }

    const service = new TestService();
    const queueManager = cleo.getQueueManager();

    await service.baseMethod();
    await service.childMethod();

    const tasks = await queueManager.getAllTasks();
    expect(tasks.length).toBe(2);
    expect(tasks.map(t => t.name)).toContain("baseMethod");
    expect(tasks.map(t => t.name)).toContain("childMethod");
  });
}); 