#!/usr/bin/env bun
// Simple end-to-end test for client-server coordination

import { CleoClient } from "../src/modes/client-mode";
import { CleoWorker } from "../src/modes/worker-mode";
import { TaskPriority } from "../src/types/enums";

console.log("🧪 Simple Client-Server Coordination Test...\n");

// Shared results tracking
const results: string[] = [];

// Step 1: Setup Worker
console.log("1️⃣ Setting up Worker...");
const worker = CleoWorker.getInstance();
await worker.configure({
  redis: {
    host: "localhost",
    port: 6379,
  },
  worker: {
    concurrency: 1,
  },
});

// Register a simple task handler (using default queue)
worker.registerTaskHandler("simple-task", async (message: string) => {
  console.log("🎯 Worker: Processing task with message:", message);
  const result = `Processed: ${message} at ${new Date().toISOString()}`;
  results.push(result);
  return result;
}, "default");

console.log("✅ Worker setup complete");

// Step 2: Setup Client (using same Redis as worker)
console.log("\n2️⃣ Setting up Client...");
const client = CleoClient.getInstance("client");
await client.configure({
  redis: {
    host: "localhost",
    port: 6379,
  },
});

console.log("✅ Client setup complete");

// Step 3: Client schedules a job using queueManager directly
console.log("\n3️⃣ Client scheduling job...");

const queueManager = client.getQueueManager();

// Try to discover the existing "default" queue created by the worker
console.log("🔍 Discovering existing queues...");
const existingQueue = await queueManager.getQueue("default");
if (!existingQueue) {
  // Create queue on client side if it doesn't exist (without workers)
  await queueManager.createQueue("default", {
    connection: {
      host: "localhost",
      port: 6379,
    },
  }, false);
  console.log("📝 Created default queue on client side");
} else {
  console.log("✅ Found existing default queue");
}

const task = await queueManager.addTask(
  "simple-task",
  "Hello from client!",
  {
    priority: TaskPriority.HIGH,
    queue: "default",
  }
);

console.log("✅ Task scheduled with ID:", task.id);

// Step 4: Wait for processing
console.log("\n4️⃣ Waiting for processing...");
const maxWaitTime = 10000; // 10 seconds
const checkInterval = 500; // 0.5 seconds
let waitTime = 0;

while (results.length === 0 && waitTime < maxWaitTime) {
  await new Promise(resolve => setTimeout(resolve, checkInterval));
  waitTime += checkInterval;
  process.stdout.write(".");
}

console.log(); // New line after dots

// Step 5: Check results
console.log("\n5️⃣ Results:");
if (results.length > 0) {
  console.log("🎉 SUCCESS: Task processed successfully!");
  console.log("📋 Result:", results[0]);
} else {
  console.log("❌ FAILURE: Task was not processed within timeout");
}

// Step 6: Check task status
console.log("\n6️⃣ Final task status:");
try {
  const finalTask = await queueManager.getTask(task.id, "default");
  if (finalTask) {
    console.log("📊 Task State:", finalTask.state);
  } else {
    console.log("⚠️ Task not found in queue (likely processed and removed)");
  }
} catch (error) {
  console.log("⚠️ Could not get task status:", error);
}

console.log("\n🏁 Test completed!");
console.log("\n📋 Summary:");
console.log("✅ Client successfully scheduled job");
console.log(`✅ Worker ${results.length > 0 ? 'successfully processed' : 'failed to process'} job`);

process.exit(results.length > 0 ? 0 : 1);
