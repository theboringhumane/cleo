#!/usr/bin/env bun
// End-to-end test for client-server coordination

import { CleoClient } from "../src/modes/client-mode";
import { CleoWorker } from "../src/modes/worker-mode";
import { TaskPriority } from "../src/types/enums";

console.log("🧪 Testing End-to-End Client-Server Coordination...\n");

// Shared results tracking
const results: { [key: string]: any } = {};
let processedTasks = 0;
const expectedTasks = 3;

// Step 1: Setup Worker First
console.log("1️⃣ Setting up Worker (Server)...");
const worker = CleoWorker.getInstance("e2e-worker");
await worker.configure({
  redis: {
    host: "localhost",
    port: 6379,
  },
  worker: {
    concurrency: 2,
  },
});

// Create queues on worker side
const workerQM = worker.getQueueManager();
await workerQM.createQueue("email", {
  connection: { host: "localhost", port: 6379 },
}, true);

await workerQM.createQueue("payments", {
  connection: { host: "localhost", port: 6379 },
}, true);

// Register task handlers that will process client jobs
worker.registerTaskHandler("sendWelcomeEmail", async (userId: string, email: string) => {
  console.log("📧 Worker: Processing welcome email", { userId, email });
  const result = { 
    success: true, 
    message: `Welcome email sent to ${email}`,
    processedAt: new Date().toISOString(),
    workerId: worker.getInstanceId()
  };
  results[`welcome-${userId}`] = result;
  processedTasks++;
  return result;
}, "email");

worker.registerTaskHandler("sendPasswordResetEmail", async (email: string, resetToken: string) => {
  console.log("🔐 Worker: Processing password reset email", { email, resetToken });
  const result = {
    success: true,
    message: `Password reset email sent to ${email}`,
    resetToken,
    processedAt: new Date().toISOString(),
    workerId: worker.getInstanceId()
  };
  results[`reset-${email}`] = result;
  processedTasks++;
  return result;
}, "email");

worker.registerTaskHandler("processPayment", async (userId: string, amount: number, currency: string) => {
  console.log("💳 Worker: Processing payment", { userId, amount, currency });
  const result = {
    success: true,
    message: `Payment of ${amount} ${currency} processed for user ${userId}`,
    transactionId: `tx_${Date.now()}`,
    processedAt: new Date().toISOString(),
    workerId: worker.getInstanceId()
  };
  results[`payment-${userId}`] = result;
  processedTasks++;
  return result;
}, "payments");

console.log("✅ Worker setup complete with task handlers registered");

// Step 2: Setup Client 
console.log("\n2️⃣ Setting up Client (NextJS app simulation)...");
const client = CleoClient.getInstance("e2e-client");
await client.configure({
  redis: {
    host: "localhost",
    port: 6379,
  },
});

// Create queues on client side (without workers)
const clientQM = client.getQueueManager();
await clientQM.createQueue("email", {
  connection: { host: "localhost", port: 6379 },
}, false); // No workers in client mode

await clientQM.createQueue("payments", {
  connection: { host: "localhost", port: 6379 },
}, false); // No workers in client mode

// Get task decorator after configuration
const { task } = await import("../src/decorators/task");

// Client service classes with decorators (simulating NextJS app)
class EmailService {
  @task({
    priority: TaskPriority.HIGH,
    queue: "email",
    group: "notifications",
    timeout: 30000,
    maxRetries: 3,
  })
  async sendWelcomeEmail(userId: string, email: string): Promise<void> {
    console.log("📤 Client: Scheduling welcome email", { userId, email });
    // This will be queued, not executed immediately
  }

  @task({
    priority: TaskPriority.MEDIUM,
    queue: "email",
    group: "notifications",
    timeout: 30000,
  })
  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    console.log("📤 Client: Scheduling password reset email", { email, resetToken });
    // This will be queued, not executed immediately
  }
}

class PaymentService {
  @task({
    priority: TaskPriority.HIGH,
    queue: "payments",
    group: "financial",
    timeout: 60000,
    maxRetries: 5,
  })
  async processPayment(userId: string, amount: number, currency: string): Promise<void> {
    console.log("📤 Client: Scheduling payment processing", { userId, amount, currency });
    // This will be queued, not executed immediately
  }
}

console.log("✅ Client setup complete");

// Step 3: Client schedules jobs (like a NextJS API would)
console.log("\n3️⃣ Client scheduling jobs...");

const emailService = new EmailService();
const paymentService = new PaymentService();

// Simulate user registration flow
console.log("👤 Simulating user registration flow...");
await emailService.sendWelcomeEmail("user123", "john@example.com");
await paymentService.processPayment("user123", 29.99, "USD");

// Simulate password reset flow  
console.log("🔒 Simulating password reset flow...");
await emailService.sendPasswordResetEmail("john@example.com", "reset_token_456");

console.log("✅ All jobs scheduled by client");

// Step 4: Wait for worker to process all jobs
console.log("\n4️⃣ Waiting for worker to process jobs...");
const maxWaitTime = 30000; // 30 seconds
const checkInterval = 1000; // 1 second
let waitTime = 0;

while (processedTasks < expectedTasks && waitTime < maxWaitTime) {
  await new Promise(resolve => setTimeout(resolve, checkInterval));
  waitTime += checkInterval;
  console.log(`⏳ Waiting... (${processedTasks}/${expectedTasks} tasks processed)`);
}

// Step 5: Verify results
console.log("\n5️⃣ Verifying results...");

if (processedTasks === expectedTasks) {
  console.log("🎉 SUCCESS: All tasks processed successfully!");
  
  console.log("\n📋 Processing Results:");
  for (const [key, result] of Object.entries(results)) {
    console.log(`✅ ${key}:`, {
      message: result.message,
      processedAt: result.processedAt,
      workerId: result.workerId
    });
  }
  
  // Verify specific task results
  console.log("\n🔍 Detailed Verification:");
  
  if (results['welcome-user123']) {
    console.log("✅ Welcome email processed correctly");
  } else {
    console.log("❌ Welcome email not processed");
  }
  
  if (results['reset-john@example.com']) {
    console.log("✅ Password reset email processed correctly");
  } else {
    console.log("❌ Password reset email not processed");
  }
  
  if (results['payment-user123']) {
    console.log("✅ Payment processed correctly");
  } else {
    console.log("❌ Payment not processed");
  }
  
} else {
  console.log(`❌ FAILURE: Only ${processedTasks}/${expectedTasks} tasks processed within ${maxWaitTime}ms`);
}

// Step 6: Check queue and worker status
console.log("\n6️⃣ Final Status Check...");

try {
  const workerStatus = await worker.getWorkerStatus("email");
  console.log("📊 Email Worker Status:", {
    status: workerStatus?.status,
    activeTasks: workerStatus?.activeTasks?.length || 0
  });
  
  const paymentWorkerStatus = await worker.getWorkerStatus("payments");
  console.log("📊 Payment Worker Status:", {
    status: paymentWorkerStatus?.status,
    activeTasks: paymentWorkerStatus?.activeTasks?.length || 0
  });
  
  // Get queue metrics
  const emailMetrics = await workerQM.getQueueMetrics("email");
  const paymentMetrics = await workerQM.getQueueMetrics("payments");
  
  console.log("📈 Queue Metrics:");
  console.log("  Email Queue:", {
    completed: emailMetrics?.completed || 0,
    failed: emailMetrics?.failed || 0,
    waiting: emailMetrics?.waiting || 0
  });
  console.log("  Payment Queue:", {
    completed: paymentMetrics?.completed || 0,
    failed: paymentMetrics?.failed || 0,
    waiting: paymentMetrics?.waiting || 0
  });
  
} catch (error) {
  console.log("⚠️ Status check failed:", error);
}

console.log("\n🏁 Test completed!");
console.log("\n📋 Summary:");
console.log(`✅ Client Mode: Scheduled ${expectedTasks} jobs successfully`);
console.log(`✅ Worker Mode: Processed ${processedTasks}/${expectedTasks} jobs`);
console.log("✅ End-to-end coordination working properly");

// Cleanup
await new Promise(resolve => setTimeout(resolve, 1000));
process.exit(processedTasks === expectedTasks ? 0 : 1);
