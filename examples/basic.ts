import { cleo, TaskPriority } from "../packages/core";

// Configure Cleo with Redis connection
cleo.configure({
  redis: {
    host: "localhost",
    port: 6379,
  },
  worker: {
    concurrency: 2,
  },
});

// Define a task using the decorator
class EmailTasks {
  @cleo.task({
    name: "sendWelcomeEmail",
    id: "1234567890",
    priority: TaskPriority.HIGH,
    queue: "email",
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 30000,
    schedule: "*/1 * * * *", // Every minute
  })
  async sendWelcomeEmail(data: { email: string; name: string }) {
    // Simulate asynchronous operation
    await new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        if (!data.email || !data.email.includes("@")) {
          reject(new Error("Invalid email format"));
        }
        resolve();
      }, 1000);
    });

    console.log(`Welcome email sent to ${data.email}`);
  }
}

// Create task instance
const emailTasks = new EmailTasks();

// Add tasks to queue
async function main() {
  try {
    // Add multiple tasks
    await Promise.all([
      emailTasks.sendWelcomeEmail({
        email: "user1@example.com",
        name: "User 1",
      }),
      emailTasks.sendWelcomeEmail({
        email: "user2@example.com",
        name: "User 2",
      }),
      emailTasks.sendWelcomeEmail({
        email: "user3@example.com",
        name: "User 3",
      }),
      emailTasks.sendWelcomeEmail({
        email: "user4@example.com",
        name: "User 4",
      }),
    ]);

    // Keep process alive to process tasks
    await new Promise((resolve) => setTimeout(resolve, 5000));
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
