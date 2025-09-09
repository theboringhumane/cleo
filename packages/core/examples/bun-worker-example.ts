// Bun Worker Example - Processes jobs from Redis queues
import { CleoWorker } from "../src/modes/worker-mode";
import { logger } from "../src/utils/logger";

// Initialize Cleo in worker mode
const cleo = CleoWorker.getInstance();


// Task handlers - these will process the jobs queued by the client
class EmailTaskHandlers {
  async sendWelcomeEmail(userId: string, email: string): Promise<void> {
    logger.info("📧 Processing welcome email", {
      file: "bun-worker-example.ts",
      function: "sendWelcomeEmail",
      userId,
      email,
    });

    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 2000));

    // In a real app, this would integrate with your email service
    console.log(`✅ Welcome email sent to ${email} for user ${userId}`);
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    logger.info("🔐 Processing password reset email", {
      file: "bun-worker-example.ts",
      function: "sendPasswordResetEmail",
      email,
    });

    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log(`✅ Password reset email sent to ${email} with token ${resetToken}`);
  }
}

class PaymentTaskHandlers {
  async processPayment(userId: string, amount: number, currency: string): Promise<void> {
    logger.info("💳 Processing payment", {
      file: "bun-worker-example.ts",
      function: "processPayment",
      userId,
      amount,
      currency,
    });

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log(`✅ Payment processed: ${amount} ${currency} for user ${userId}`);
  }
}

class UserOnboardingHandlers {
  async createUserProfile(userId: string, profileData: any): Promise<void> {
    logger.info("👤 Creating user profile", {
      file: "bun-worker-example.ts",
      function: "createUserProfile",
      userId,
      profileData,
    });

    // Simulate profile creation
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log(`✅ User profile created for ${userId}:`, profileData);
  }
}

// Register all task handlers
function registerTaskHandlers() {
  const emailHandlers = new EmailTaskHandlers();
  const paymentHandlers = new PaymentTaskHandlers();
  const onboardingHandlers = new UserOnboardingHandlers();

  // Register email tasks
  cleo.registerTaskHandler("send-welcome-email", emailHandlers.sendWelcomeEmail.bind(emailHandlers), "email");
  cleo.registerTaskHandler("send-password-reset-email", emailHandlers.sendPasswordResetEmail.bind(emailHandlers), "email");

  // Register payment tasks
  cleo.registerTaskHandler("process-payment", paymentHandlers.processPayment.bind(paymentHandlers), "payments");

  // Register onboarding tasks
  cleo.registerTaskHandler("create-user-profile", onboardingHandlers.createUserProfile.bind(onboardingHandlers), "default");

  logger.info("🎯 All task handlers registered", {
    file: "bun-worker-example.ts",
    function: "registerTaskHandlers",
  });
}

// Health check function
async function healthCheck() {
  try {
    const workers = await cleo.getAllWorkersStatus();
    const queueManager = cleo.getQueueManager();

    logger.info("🏥 Worker health check", {
      file: "bun-worker-example.ts",
      function: "healthCheck",
      activeWorkers: workers.length,
      workers: workers.map(w => ({
        id: w.id,
        queue: w.queue,
        status: w.status,
        activeTasks: w.activeTasks.length,
      })),
    });

    return true;
  } catch (error) {
    logger.error("❌ Health check failed", {
      file: "bun-worker-example.ts",
      function: "healthCheck",
      error,
    });
    return false;
  }
}

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`🛑 Received ${signal}, shutting down gracefully...`, {
    file: "bun-worker-example.ts",
    function: "gracefulShutdown",
  });

  try {
    await cleo.stopProcessing();
    logger.info("✅ Worker shutdown complete");
    process.exit(0);
  } catch (error) {
    logger.error("❌ Error during shutdown", {
      file: "bun-worker-example.ts",
      function: "gracefulShutdown",
      error,
    });
    process.exit(1);
  }
}

// Main function
async function main() {
  try {
    logger.info("🚀 Starting Cleo Worker", {
      file: "bun-worker-example.ts",
      function: "main",
    });

    // Configure Cleo worker first
    await cleo.configure({
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD,
      },
      worker: {
        concurrency: 5, // Process up to 5 jobs concurrently
      },
    });

    // Create workers for all queues we need
    const queueManager = cleo.getQueueManager();
    await queueManager.createQueue("email", {
      connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD,
      },
    });
    await queueManager.createQueue("payments", {
      connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD,
      },
    });

    // Register task handlers
    registerTaskHandlers();

    // Start processing jobs
    await cleo.startProcessing();

    // Set up health checks every 30 seconds
    setInterval(healthCheck, 30000);

    // Set up graceful shutdown
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

    logger.info("✅ Cleo Worker started successfully", {
      file: "bun-worker-example.ts",
      function: "main",
    });

  } catch (error) {
    logger.error("❌ Failed to start Cleo Worker", {
      file: "bun-worker-example.ts",
      function: "main",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    console.error("Full error:", error);
    process.exit(1);
  }
}

// Start the worker
if (import.meta.main) {
  main();
}
