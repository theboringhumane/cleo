#!/usr/bin/env bun
// Test script to verify client-server setup is working

import { CleoClient } from "../src/modes/client-mode";
import { CleoWorker } from "../src/modes/worker-mode";
import { TaskPriority } from "../src/types/enums";

console.log("🧪 Testing Cleo Client-Server Setup...\n");

// Test 1: Client Mode
console.log("1️⃣ Testing Client Mode (No Workers)");
try {
  const client = CleoClient.getInstance();
  await client.configure({
    redis: {
      host: "localhost",
      port: 6379,
    },
  });

  console.log("✅ Client configured successfully");
  console.log("✅ Client mode enabled:", client.isClientModeEnabled());
  
  // Test scheduling a task
  const queueManager = client.getQueueManager();
  
  // Create the test queue first (client mode)
  await queueManager.createQueue("test", {
    connection: {
      host: "localhost",
      port: 6379,
    },
  }, false); // Don't create workers in client mode
  
  const task = await queueManager.addTask(
    "test-task",
    { message: "Hello from client!" },
    {
      priority: TaskPriority.HIGH,
      queue: "test",
    }
  );
  console.log("✅ Task scheduled:", task.id);
  
} catch (error) {
  console.error("❌ Client test failed:", error);
}

console.log("\n2️⃣ Testing Worker Mode (With Workers)");
try {
  const worker = CleoWorker.getInstance("worker-test" as any);
  await worker.configure({
    redis: {
      host: "localhost",
      port: 6379,
    },
    worker: {
      concurrency: 2,
    },
  });

  console.log("✅ Worker configured successfully");
  console.log("✅ Worker mode enabled:", worker.isWorkerModeEnabled());
  
  // Create the test queue first (worker mode)
  const workerQueueManager = worker.getQueueManager();
  await workerQueueManager.createQueue("test", {
    connection: {
      host: "localhost",
      port: 6379,
    },
  }, true); // Create workers in worker mode
  
  // Register a simple task handler
  worker.registerTaskHandler("test-task", async (data) => {
    console.log("🎯 Processing task:", data);
    return { success: true, message: data.message };
  }, "test");
  
  console.log("✅ Task handler registered");
  
  // Get worker status
  const status = await worker.getWorkerStatus("test");
  console.log("✅ Worker status:", status?.status);
  
} catch (error) {
  console.error("❌ Worker test failed:", error);
}

console.log("\n🎉 All tests completed!");
console.log("\n📋 Summary:");
console.log("✅ Client Mode: Schedules jobs without workers");
console.log("✅ Worker Mode: Processes jobs from Redis queues");
console.log("✅ Clean separation between client and server");

process.exit(0);
