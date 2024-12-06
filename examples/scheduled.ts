import { cleo } from "@cleotasks/core/dist/src/index";

// Configure Cleo with Redis connection
cleo.configure({
  redis: {
    host: 'localhost',
    port: 6379,
  },
  worker: {
    concurrency: 1,
  },
});

// Define tasks with schedules
class ScheduledTasks {
  @cleo.task({
    schedule: '*/5 * * * *', // Every 5 minutes
    maxRetries: 2,
  })
  async generateReport(data: { reportType: string }) {
    console.log(`Generating ${data.reportType} report at ${new Date().toISOString()}`);
    // Simulate report generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(`${data.reportType} report generated`);
    return { success: true, timestamp: new Date() };
  }

  @cleo.task({
    schedule: '0 0 * * *', // Every day at midnight
  })
  async cleanupOldData() {
    console.log(`Running daily cleanup at ${new Date().toISOString()}`);
    // Simulate cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Cleanup completed');
    return { success: true };
  }
}

// Create task instance
const scheduledTasks = new ScheduledTasks();

// Add tasks to queue
async function main() {
  try {
    // Schedule tasks
    await scheduledTasks.generateReport({ reportType: 'Daily Analytics' });
    await scheduledTasks.cleanupOldData();

    console.log('Tasks scheduled');

    // Keep process alive
    await new Promise(resolve => setTimeout(resolve, 10000));
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main(); 