import Redis from "ioredis-mock";
import type { Redis as RedisType } from "ioredis";
import { TaskGroup } from "../groups/taskGroup";
import { TaskStatus } from "../types/enums";

describe("TaskGroup", () => {
  let redis: RedisType;
  let group: TaskGroup;

  beforeEach(() => {
    redis = new Redis() as unknown as RedisType;
    group = new TaskGroup(redis, "testGroup");
  });

  test("should add and retrieve tasks", async () => {
    await group.addTask("task1");
    await group.addTask("task2");
    
    const tasks = await group.getTasks();
    expect(tasks).toContain("task1");
    expect(tasks).toContain("task2");
    expect(tasks.length).toBe(2);
  });

  test("should track task status", async () => {
    await group.addTask("task1");
    await group.updateTaskStatus("task1", TaskStatus.ACTIVE);
    
    const status = await group.getTaskStatus("task1");
    expect(status).toBe(TaskStatus.ACTIVE);
  });

  test("should remove tasks", async () => {
    await group.addTask("task1");
    await group.removeTask("task1");
    
    const tasks = await group.getTasks();
    expect(tasks).not.toContain("task1");
  });

  test("should get group stats", async () => {
    await group.addTask("task1");
    await group.addTask("task2");
    await group.updateTaskStatus("task1", TaskStatus.ACTIVE);
    await group.updateTaskStatus("task2", TaskStatus.COMPLETED);

    const stats = await group.getStats();
    expect(stats).toEqual({
      total: 2,
      active: 1,
      completed: 1,
      failed: 0,
      paused: 0,
    });
  });

  test("should pause all tasks", async () => {
    await group.addTask("task1");
    await group.addTask("task2");
    await group.pauseAll();

    const status1 = await group.getTaskStatus("task1");
    const status2 = await group.getTaskStatus("task2");
    expect(status1).toBe(TaskStatus.PAUSED);
    expect(status2).toBe(TaskStatus.PAUSED);
  });

  test("should resume all tasks", async () => {
    await group.addTask("task1");
    await group.addTask("task2");
    await group.pauseAll();
    await group.resumeAll();

    const status1 = await group.getTaskStatus("task1");
    const status2 = await group.getTaskStatus("task2");
    expect(status1).toBe(TaskStatus.ACTIVE);
    expect(status2).toBe(TaskStatus.ACTIVE);
  });
});
