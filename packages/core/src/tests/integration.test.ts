import Redis from "ioredis-mock";
import type { Redis as RedisType } from "ioredis";
import { QueueManager } from "../queue/queueManager";
import { ObserverEvent, TaskStatus, GroupOperation } from "../types/enums";

describe("QueueManager Integration", () => {
  let redis: RedisType;
  let queueManager: QueueManager;

  beforeEach(() => {
    redis = new Redis() as unknown as RedisType;
    queueManager = new QueueManager("test-queue");
  });

  test("should handle task groups and events", async () => {
    const events: any[] = [];

    // Subscribe to events
    queueManager.onTaskEvent(ObserverEvent.GROUP_CHANGE, (taskId, status, data) => {
      events.push({ taskId, status, data });
    });

    // Add tasks to group
    await queueManager.addTask("test-task", { data: "test" }, { id: "task-1" });
    await queueManager.addTaskToGroup("task-1", "test-group");

    // Verify group contents
    const groupTasks = await queueManager.getGroupTasks("test-group");
    expect(groupTasks).toHaveLength(1);
    expect(groupTasks[0].id).toBe("task-1");

    // Verify events
    expect(events).toHaveLength(1);
    expect(events[0].data.operation).toBe(GroupOperation.ADD);
    expect(events[0].data.group).toBe("test-group");
  });

  test("should handle task status updates", async () => {
    const statusUpdates: any[] = [];

    queueManager.onTaskEvent(ObserverEvent.STATUS_CHANGE, (taskId, status) => {
      statusUpdates.push({ taskId, status });
    });

    const task = await queueManager.addTask("test-task", { data: "test" }, { id: "task-1" });
    
    // Simulate status update
    await (queueManager as any).updateTaskStatus("task-1", TaskStatus.ACTIVE);

    expect(statusUpdates).toHaveLength(1);
    expect(statusUpdates[0].status).toBe(TaskStatus.ACTIVE);
    expect(statusUpdates[0].taskId).toBe("task-1");
  });
}); 