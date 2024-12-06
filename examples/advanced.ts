import { cleo, TaskPriority } from "@cleotasks/core/dist/src/index";
import { logger } from "@cleotasks/core/dist/src/utils/logger";
import { ProgressTracker } from "@cleotasks/core/dist/src/progress/progressTracker";
import { ResultCache } from "@cleotasks/core/dist/src/cache/resultCache";
import { DeadLetterQueue } from "@cleotasks/core/dist/src/queue/deadLetterQueue";

// Initialize components
const progressTracker = new ProgressTracker(3001);
const resultCache = new ResultCache({
  enabled: true,
  ttl: 3600,
  strategy: "redis",
});
const dlq = new DeadLetterQueue({
  maxRetries: 3,
  backoff: {
    type: "exponential",
    delay: 1000,
  },
  alertThreshold: 5,
});

// Configure Cleo with priority queues
cleo.configure({
  redis: {
    host: "localhost",
    port: 6379,
  },
  worker: {
    concurrency: 3,
    queues: [
      {
        name: "critical",
        priority: 4,
        rateLimit: { max: 100, interval: 60000 },
      },
      {
        name: "high",
        priority: 3,
        rateLimit: { max: 50, interval: 60000 },
      },
      {
        name: "normal",
        priority: 2,
      },
      {
        name: "low",
        priority: 1,
        rateLimit: { max: 10, interval: 60000 },
      },
    ],
  },
});

// Define tasks with different priorities and dependencies
class AdvancedTasks {
  @cleo.task({
    queue: "critical",
    priority: TaskPriority.CRITICAL,
  })
  async processPayment(data: { userId: string; amount: number }) {
    const cacheKey = `payment:${data.userId}:${data.amount}`;

    // Check cache first
    const cached = await resultCache.get("processPayment", cacheKey);
    if (cached) {
      return cached;
    }

    // Process payment with progress tracking
    for (let i = 0; i <= 100; i += 10) {
      progressTracker.updateProgress(`payment-${data.userId}`, i, {
        cpuUsage: Math.random() * 50,
        memoryUsage: Math.random() * 1024 * 1024,
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const result = { success: true, transactionId: `tx-${Date.now()}` };
    await resultCache.set("processPayment", cacheKey, result);
    return result;
  }

  @cleo.task({
    queue: "high",
    priority: TaskPriority.HIGH,
  })
  async sendReceipt(data: { userId: string; transactionId: string }) {
    // Simulate email sending with progress
    for (let i = 0; i <= 100; i += 20) {
      progressTracker.updateProgress(`receipt-${data.transactionId}`, i);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    return { sent: true, to: data.userId };
  }

  @cleo.task({
    queue: "normal",
    priority: TaskPriority.NORMAL,
  })
  async updateAnalytics(data: { userId: string; transactionId: string }) {
    // Simulate analytics processing
    for (let i = 0; i <= 100; i += 25) {
      progressTracker.updateProgress(`analytics-${data.transactionId}`, i);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return { updated: true };
  }
}

// Set up DLQ monitoring
dlq.on("alert", ({ count, threshold }) => {
  logger.warn(
    "advanced.ts",
    "⚠️",
    "120",
    "dlq.alert",
    "count",
    `Dead Letter Queue alert: ${count} failed tasks (threshold: ${threshold})`
  );
});

async function main() {
  try {
    const tasks = new AdvancedTasks();
    const userId = `user-${Date.now()}`;

    // Process payment
    const payment = await tasks.processPayment({
      userId,
      amount: 99.99,
    });

    if (payment.success) {
      // Send receipt and update analytics in parallel
      await Promise.all([
        tasks.sendReceipt({
          userId,
          transactionId: payment.transactionId,
        }),
        tasks.updateAnalytics({
          userId,
          transactionId: payment.transactionId,
        }),
      ]);
    }

    // Keep process alive to handle tasks
    await new Promise((resolve) => setTimeout(resolve, 30000));

    // Cleanup
    await progressTracker.close();
    await resultCache.clear();
    process.exit(0);
  } catch (error) {
    logger.error("advanced.ts", "❌", "155", "main", "error", "Error:", error);
    process.exit(1);
  }
}

main();
