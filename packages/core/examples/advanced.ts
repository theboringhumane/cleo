import { Cleo } from "../src";
import { QueueClass } from "../src/decorators/class";
import {
  TaskPriority,
  ObserverEvent,
  GroupProcessingStrategy,
} from "../src/types/enums";

// Get Cleo instance and configure it first
const cleo = Cleo.getInstance();

cleo.configure({
  redis: {
    host: "localhost",
    port: 6379,
    password: "cleosecret",
  },
  worker: {
    concurrency: 3,
    queues: [
      { name: "notifications", priority: TaskPriority.HIGH },
      { name: "emails", priority: TaskPriority.NORMAL },
      { name: "reports", priority: TaskPriority.LOW },
    ],
  },
});

// Get queue manager for monitoring
const queueManager = cleo.getQueueManager();

// Set up observers for monitoring
queueManager.onTaskEvent(
  ObserverEvent.STATUS_CHANGE,
  (taskId, status, data) => {
    console.log(`💬 Task ${taskId} status changed to ${status}`, data);
  }
);

queueManager.onTaskEvent(ObserverEvent.GROUP_CHANGE, (taskId, status, data) => {
  console.log(`👥 Task ${taskId} group operation: ${data.operation}`, data);
});

// Example service using class decorator with group
@QueueClass({
  defaultOptions: {
    maxRetries: 3,
    retryDelay: 1000,
    backoff: {
      type: "fixed",
      delay: 2000,
    },
    group: "user1",
    timeout: 300000,
  },
  queue: "notifications",
})
class User1NotificationService {
  async sendPushNotification(data: { message: string }) {
    console.log(`📱 User1: Sending push notification: ${data.message}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return `User1 notification sent: ${data.message}`;
  }

  async sendSMS(data: { message: string }) {
    console.log(`📲 User1: Sending SMS: ${data.message}`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    return `User1 SMS sent: ${data.message}`;
  }

  async sendEmail(data: { message: string }) {
    console.log(`📧 User1: Sending email: ${data.message}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    return `User1 email sent: ${data.message}`;
  }

  async sendErrorTask(data: { message: string }) {
    console.log(`⚠️ User1: Simulating error task: ${data.message}`);
    throw new Error('Simulated error in User1 task');
  }
}

@QueueClass({
  defaultOptions: {
    maxRetries: 3,
    backoff: {
      type: "fixed",
      delay: 2000,
    },
    retryDelay: 1000,
    group: "user2",
    timeout: 300000,
  },
  queue: "notifications",
})
class User2NotificationService {
  async sendPushNotification(data: { message: string }) {
    console.log(`📱 User2: Sending push notification: ${data.message}`);
    await new Promise(resolve => setTimeout(resolve, 800));
    return `User2 notification sent: ${data.message}`;
  }

  async sendSMS(data: { message: string }) {
    console.log(`📲 User2: Sending SMS: ${data.message}`);
    await new Promise(resolve => setTimeout(resolve, 1200));
    return `User2 SMS sent: ${data.message}`;
  }

  async sendEmail(data: { message: string }) {
    console.log(`📧 User2: Sending email: ${data.message}`);
    await new Promise(resolve => setTimeout(resolve, 1800));
    return `User2 email sent: ${data.message}`;
  }

  async sendErrorTask(data: { message: string }) {
    console.log(`⚠️ User2: Simulating error task: ${data.message}`);
    throw new Error('Simulated error in User2 task');
  }
}

// Create instances
const user1Service = new User1NotificationService();
const user2Service = new User2NotificationService();

async function demonstrateRoundRobin() {
  console.log("\n🔄 Testing ROUND_ROBIN Strategy...");
  queueManager.setGroupProcessingStrategy(GroupProcessingStrategy.ROUND_ROBIN);

  const tasks = [
    user1Service.sendPushNotification({ message: "RR: User1 Push 1" }),
    user1Service.sendPushNotification({ message: "RR: User1 Push 2" }),
    user2Service.sendPushNotification({ message: "RR: User2 Push 1" }),
    user2Service.sendPushNotification({ message: "RR: User2 Push 2" }),
  ];

  await Promise.all(tasks);
}

async function demonstrateFIFO() {
  console.log("\n📝 Testing FIFO Strategy...");
  queueManager.setGroupProcessingStrategy(GroupProcessingStrategy.FIFO);

  const tasks = [
    user1Service.sendSMS({ message: "FIFO: User1 SMS 1" }),
    user1Service.sendSMS({ message: "FIFO: User1 SMS 2" }),
    user2Service.sendSMS({ message: "FIFO: User2 SMS 1" }),
    user2Service.sendSMS({ message: "FIFO: User2 SMS 2" }),
  ];

  await Promise.all(tasks);
}

async function demonstratePriority() {
  console.log("\n⭐ Testing PRIORITY Strategy...");
  queueManager.setGroupProcessingStrategy(GroupProcessingStrategy.PRIORITY);

  // Set different priorities
  await queueManager.setGroupPriority("user1", 1);
  await queueManager.setGroupPriority("user2", 10); // Higher priority

  const tasks = [
    user1Service.sendEmail({ message: "Priority: User1 Email 1" }),
    user1Service.sendEmail({ message: "Priority: User1 Email 2" }),
    user2Service.sendEmail({ message: "Priority: User2 Email 1" }),
    user2Service.sendEmail({ message: "Priority: User2 Email 2" }),
  ];

  await Promise.all(tasks);
}

async function demonstrateErrorHandling() {
  console.log("\n⚠️ Testing Error Handling...");
  queueManager.setGroupProcessingStrategy(GroupProcessingStrategy.ROUND_ROBIN);

  const tasks = [
    user1Service.sendPushNotification({ message: "Success task before error" }),
    user1Service.sendErrorTask({ message: "This will fail" }),
    user1Service.sendPushNotification({ message: "Success task after error" }),
    user2Service.sendErrorTask({ message: "This will also fail" }),
    user2Service.sendPushNotification({ message: "Another success task" }),
  ];

  await Promise.all(tasks);
}

// Main demonstration
async function demonstrateGroupProcessing() {
  console.log("\n🚀 Starting Advanced Group Processing Demonstration...\n");

  // Monitor task events
  queueManager.onTaskEvent(ObserverEvent.TASK_COMPLETED, (taskId, status, result) => {
    console.log(`✅ Task ${taskId} completed with result:`, result);
  });

  queueManager.onTaskEvent(ObserverEvent.TASK_FAILED, (taskId, status, error) => {
    console.log(`❌ Task ${taskId} failed:`, error);
    queueManager.offTaskEvent(ObserverEvent.TASK_COMPLETED);
    queueManager.offTaskEvent(ObserverEvent.TASK_FAILED);
  });

  try {
    // Test different strategies
    await demonstrateRoundRobin();
    await demonstrateFIFO();
    await demonstratePriority();
    await demonstrateErrorHandling();

    // Print final stats
    console.log("\n📊 Final Group Statistics:");
    const user1Stats = await (await queueManager.getGroup("user1")).getStats();
    const user2Stats = await (await queueManager.getGroup("user2")).getStats();
    console.log("User 1 Final Stats:", user1Stats);
    console.log("User 2 Final Stats:", user2Stats);

  } catch (error) {
    console.error("❌ Demonstration failed:", error);
  } finally {
    // Cleanup
    await queueManager.close();
    process.exit(0);
  }
}

// Run the demonstration
console.log("🔄 Starting advanced queue demonstration...");
demonstrateGroupProcessing().catch(error => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
