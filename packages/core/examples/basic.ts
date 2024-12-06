import { cleo, TaskPriority } from '../src';

// Configure Cleo with Redis connection
cleo.configure({
  redis: {
    host: 'localhost',
    port: 6379,
  },
  worker: {
    concurrency: 2,
  },
});

// Define a task using the decorator
class EmailTasks {
  @cleo.task({
    maxRetries: 3,
    retryDelay: 1000,
    priority: TaskPriority.HIGH,
  })
  async sendWelcomeEmail(data: { email: string; name: string }) {
    console.log(`Sending welcome email to ${data.email}`);
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`Welcome email sent to ${data.email}`);
    return { success: true };
  }
}

// Create task instance
const emailTasks = new EmailTasks();

// Add tasks to queue
async function main() {
  try {
    // Add multiple tasks
    const tasks = await Promise.all([
      emailTasks.sendWelcomeEmail({ email: 'user1@example.com', name: 'User 1' }),
      emailTasks.sendWelcomeEmail({ email: 'user2@example.com', name: 'User 2' }),
      emailTasks.sendWelcomeEmail({ email: 'user3@example.com', name: 'User 3' }),
    ]);

    console.log('Tasks added to queue:', tasks);

    // Keep process alive to process tasks
    await new Promise(resolve => setTimeout(resolve, 5000));
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main(); 