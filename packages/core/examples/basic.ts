import { task } from "../src/decorators/task";
import { ObserverEvent, TaskPriority } from "../src/types/enums";
import { Cleo } from "../src";

const cleo = Cleo.getInstance();

cleo.configure({
  redis: {
    host: "localhost",
    port: 6379,
    password: "cleosecret",
  },
  worker: {
    concurrency: 4,
    queues: [
      {
        name: "send-email",
        priority: TaskPriority.HIGH,
      },
    ],
  },
});

class EmailService {
  @task({
    id: "send-email",
    priority: TaskPriority.HIGH,
    queue: 'send-email',
  })
  sendEmail(input: { email: string }): Promise<string> {
    console.log("🚀 ~ EmailService ~ sendEmail ~ input", {
      file: "basic.ts",
      line: 31,
      function: "sendEmail",
      input,
    });
    return Promise.resolve(`Sent to ${input.email}`);
  }
}

const emailService = new EmailService();

// Get queue manager for monitoring
const queueManager = cleo.getQueueManager();

// Set up observers for monitoring
queueManager.onTaskEvent(ObserverEvent.STATUS_CHANGE, (taskId, status, data) => {
  console.log(`Task ${taskId} status changed to ${status}`, data);
});

queueManager.onTaskEvent(ObserverEvent.TASK_ADDED, (taskId, status, data) => {
  console.log(`Task ${taskId} added to queue`, status, data);
});

queueManager.onTaskEvent(ObserverEvent.TASK_COMPLETED, (taskId, status, data) => {
  console.log(`Task ${taskId} completed`, status, data);
  process.exit(0);
});

emailService.sendEmail({ email: "test@test.com" });