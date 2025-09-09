// NextJS Client Example - Only schedules jobs, no processing
import { CleoClient } from "../src/modes/client-mode";
import { TaskPriority } from "../src/types/enums";

// Initialize Cleo in client mode
const cleo = CleoClient.getInstance();

// Configure Cleo (this would typically be in your app initialization)
await cleo.configure({
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
  },
});

// Get the task decorator after configuration
const { task } = await import("../src/decorators/task");

// Example service class with task decorators
class EmailService {
  @task({
    priority: TaskPriority.HIGH,
    queue: "email",
    group: "notifications",
    timeout: 30000,
    maxRetries: 3,
  })
  async sendWelcomeEmail(userId: string, email: string): Promise<void> {
    // This method will be queued, not executed immediately
    console.log(`Sending welcome email to ${email} for user ${userId}`);
    
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // In a real app, this would send an actual email
    console.log(`Welcome email sent to ${email}`);
  }

  @task({
    priority: TaskPriority.MEDIUM,
    queue: "email",
    group: "notifications",
    timeout: 60000,
  })
  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    console.log(`Sending password reset email to ${email}`);
    
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`Password reset email sent to ${email}`);
  }
}

// Example API route handler (NextJS)
export async function POST(request: Request) {
  try {
    const { action, userId, email, resetToken } = await request.json();
    
    const emailService = new EmailService();
    
    switch (action) {
      case "send-welcome":
        // This will queue the task, not execute it immediately
        await emailService.sendWelcomeEmail(userId, email);
        return Response.json({ 
          success: true, 
          message: "Welcome email queued successfully" 
        });
        
      case "send-password-reset":
        await emailService.sendPasswordResetEmail(email, resetToken);
        return Response.json({ 
          success: true, 
          message: "Password reset email queued successfully" 
        });
        
      default:
        return Response.json({ 
          success: false, 
          message: "Invalid action" 
        }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in API route:", error);
    return Response.json({ 
      success: false, 
      message: "Internal server error" 
    }, { status: 500 });
  }
}

// Example of using queueManager directly (without decorators)
export async function scheduleCustomTask() {
  const queueManager = cleo.getQueueManager();
  
  // Schedule a custom task
  const task = await queueManager.addTask(
    "process-payment",
    {
      userId: "123",
      amount: 99.99,
      currency: "USD",
    },
    {
      priority: TaskPriority.HIGH,
      queue: "payments",
      group: "financial",
      timeout: 120000,
      maxRetries: 5,
    }
  );
  
  console.log("Custom task scheduled:", task.id);
  return task;
}

// Example of scheduling group tasks
export async function scheduleGroupTasks() {
  const queueManager = cleo.getQueueManager();
  
  // Schedule multiple tasks to a group
  await queueManager.addTaskToGroup(
    "send-welcome-email",
    {
      group: "user-onboarding",
      priority: TaskPriority.HIGH,
    },
    {
      userId: "123",
      email: "user@example.com",
    }
  );
  
  await queueManager.addTaskToGroup(
    "create-user-profile",
    {
      group: "user-onboarding",
      priority: TaskPriority.NORMAL,
    },
    {
      userId: "123",
      profileData: { name: "John Doe" },
    }
  );
  
  console.log("Group tasks scheduled");
}

// Example of how to use this in a NextJS app initialization
export async function initializeCleo() {
  try {
    await cleo.configure({
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD,
      },
    });
    
    console.log("✅ Cleo client initialized successfully");
    return cleo;
  } catch (error) {
    console.error("❌ Failed to initialize Cleo client:", error);
    throw error;
  }
}