import { TaskHistoryService } from "../src/services/taskHistory";
import { redisConnection, RedisInstance } from "../src/config/redis";
import { logger } from "../src/utils/logger";

/**
 * Example demonstrating the TaskHistoryService functionality
 */
async function taskHistoryExample() {
  try {
    // Initialize Redis connection (you would normally do this in your main app)
    redisConnection.initializeInstance(RedisInstance.DEFAULT, {
      REDIS_HOST: "localhost",
      REDIS_PORT: "6379",
      INSTANCE_ID: RedisInstance.DEFAULT,
      // REDIS_PASSWORD: "your-password", // if needed
    });

    // Get the TaskHistoryService instance
    const taskHistoryService = TaskHistoryService.getInstance();

    console.log("🚀 Starting TaskHistory example...");

    // Example 1: Add some task history entries
    console.log("\n📝 Adding task history entries...");
    
    await taskHistoryService.addTaskHistory(
      "task-001",
      "completed",
      1500, // 1.5 seconds
      "worker-1",
      "email-queue",
      undefined, // no error
      "email-group"
    );

    await taskHistoryService.addTaskHistory(
      "task-002",
      "failed",
      800,
      "worker-1",
      "email-queue",
      "Connection timeout",
      "email-group"
    );

    await taskHistoryService.addTaskHistory(
      "task-003",
      "completed",
      2200,
      "worker-2",
      "image-processing-queue",
      undefined,
      "image-group"
    );

    await taskHistoryService.addTaskHistory(
      "task-004",
      "completed",
      950,
      "worker-1",
      "notification-queue"
      // no group
    );

    console.log("✅ Task history entries added successfully");

    // Example 2: Get worker-specific history
    console.log("\n👷 Getting worker-1 history...");
    const worker1History = await taskHistoryService.getWorkerHistory("worker-1", 10);
    console.log(`Found ${worker1History.length} entries for worker-1:`, 
      worker1History.map(h => ({ taskId: h.taskId, status: h.status, duration: h.duration }))
    );

    // Example 3: Get task-specific history
    console.log("\n📋 Getting history for task-001...");
    const task001History = await taskHistoryService.getTaskHistory("task-001", 10);
    console.log(`Found ${task001History.length} entries for task-001:`, task001History);

    // Example 4: Get global history
    console.log("\n🌍 Getting global task history...");
    const globalHistory = await taskHistoryService.getGlobalHistory(5);
    console.log(`Found ${globalHistory.length} global entries:`,
      globalHistory.map(h => ({ taskId: h.taskId, status: h.status, workerId: h.workerId, queueName: h.queueName }))
    );

    // Example 5: Get queue-specific history
    console.log("\n📬 Getting email-queue history...");
    const emailQueueHistory = await taskHistoryService.getQueueHistory("email-queue", 10);
    console.log(`Found ${emailQueueHistory.length} entries for email-queue:`,
      emailQueueHistory.map(h => ({ taskId: h.taskId, status: h.status, duration: h.duration }))
    );

    // Example 6: Get group-specific history
    console.log("\n👥 Getting email-group history...");
    const emailGroupHistory = await taskHistoryService.getGroupHistory("email-group", 10);
    console.log(`Found ${emailGroupHistory.length} entries for email-group:`,
      emailGroupHistory.map(h => ({ taskId: h.taskId, status: h.status, duration: h.duration }))
    );

    // Example 7: Get history statistics
    console.log("\n📊 Getting task history statistics...");
    const stats = await taskHistoryService.getHistoryStats();
    console.log("Task History Statistics:", {
      totalTasks: stats.totalTasks,
      completedTasks: stats.completedTasks,
      failedTasks: stats.failedTasks,
      averageDuration: `${stats.averageDuration.toFixed(2)}ms`,
      successRate: `${((stats.completedTasks / stats.totalTasks) * 100).toFixed(1)}%`
    });

    // Example 8: Clear specific worker history (optional)
    console.log("\n🗑️ Clearing worker-2 history...");
    await taskHistoryService.clearWorkerHistory("worker-2");
    console.log("✅ Worker-2 history cleared");

    // Verify the clear operation
    const worker2HistoryAfterClear = await taskHistoryService.getWorkerHistory("worker-2", 10);
    console.log(`Worker-2 history after clear: ${worker2HistoryAfterClear.length} entries`);

    console.log("\n🎉 TaskHistory example completed successfully!");

  } catch (error) {
    console.error("❌ TaskHistory example failed:", error);
    logger.error("TaskHistory example error", { error });
  }
}

/**
 * Example of integrating TaskHistoryService with a Worker
 */
async function workerIntegrationExample() {
  try {
    console.log("\n🔧 Worker Integration Example...");
    
    const taskHistoryService = TaskHistoryService.getInstance();
    
    // Simulate a worker processing tasks
    const workerId = "example-worker-1";
    const queueName = "example-queue";
    
    // Simulate processing multiple tasks
    const tasks = [
      { id: "sim-task-1", processingTime: 1200, willFail: false },
      { id: "sim-task-2", processingTime: 800, willFail: true },
      { id: "sim-task-3", processingTime: 1500, willFail: false },
    ];
    
    for (const task of tasks) {
      const startTime = Date.now();
      
      try {
        // Simulate task processing
        await new Promise(resolve => setTimeout(resolve, task.processingTime));
        
        if (task.willFail) {
          throw new Error("Simulated task failure");
        }
        
        // Task completed successfully
        const duration = Date.now() - startTime;
        await taskHistoryService.addTaskHistory(
          task.id,
          "completed",
          duration,
          workerId,
          queueName,
          undefined,
          "simulation-group"
        );
        
        console.log(`✅ Task ${task.id} completed in ${duration}ms`);
        
      } catch (error) {
        // Task failed
        const duration = Date.now() - startTime;
        await taskHistoryService.addTaskHistory(
          task.id,
          "failed",
          duration,
          workerId,
          queueName,
          error.message,
          "simulation-group"
        );
        
        console.log(`❌ Task ${task.id} failed after ${duration}ms: ${error.message}`);
      }
    }
    
    // Get the worker's history
    const workerHistory = await taskHistoryService.getWorkerHistory(workerId);
    console.log(`\n📋 Worker ${workerId} processed ${workerHistory.length} tasks`);
    
    // Get updated statistics
    const updatedStats = await taskHistoryService.getHistoryStats();
    console.log("📊 Updated Statistics:", {
      totalTasks: updatedStats.totalTasks,
      completedTasks: updatedStats.completedTasks,
      failedTasks: updatedStats.failedTasks,
      successRate: `${((updatedStats.completedTasks / updatedStats.totalTasks) * 100).toFixed(1)}%`
    });
    
  } catch (error) {
    console.error("❌ Worker integration example failed:", error);
  }
}

// Run the examples
async function runExamples() {
  await taskHistoryExample();
  await workerIntegrationExample();
  
  // Optional: Clean up all history at the end
  // const taskHistoryService = TaskHistoryService.getInstance();
  // await taskHistoryService.clearAllHistory();
  // console.log("\n🧹 All task history cleared");
  
  process.exit(0);
}

// Run if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

export { taskHistoryExample, workerIntegrationExample }; 