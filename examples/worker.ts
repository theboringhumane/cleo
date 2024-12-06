import { cleo, TaskState, Worker } from "@cleotasks/core/dist/src/index";
import { logger } from "@cleotasks/core/dist/src/utils/logger";

// Configure Cleo with Redis connection
cleo.configure({
  redis: {
    host: 'localhost',
    port: 6379,
  },
  worker: {
    concurrency: 3,
  }
});

// Get worker instance from Cleo
const worker = cleo.getWorker() || new Worker('email-queue', { concurrency: 3 });

// Register task handler
worker.registerTask('sendEmail', async (data: any) => {
  logger.info('Worker.ts', '🔄', '50', 'process', 'data', 'Processing job:', data);
  
  // Simulate task processing
  for (let i = 0; i <= 100; i += 20) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  if (Math.random() > 0.8) {
    throw new Error('Random failure simulation');
  }
  
  return { state: TaskState.SUCCESS, result: 'Task processed successfully' };
});

// Start worker
async function main() {
  try {
    logger.info('Worker.ts', '🚀', '67', 'main', 'worker', 'Starting worker...');
    
    // Keep worker running
    process.on('SIGTERM', async () => {
      logger.info('Worker.ts', '🛑', '72', 'main', 'worker', 'Gracefully shutting down worker...');
      await worker.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Worker.ts', '💥', '77', 'main', 'error', 'Worker error:', error);
    process.exit(1);
  }
}

main(); 