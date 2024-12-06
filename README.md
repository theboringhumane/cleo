# 🚀 Cleo - Modern Distributed Task Queue System

[![npm version](https://badge.fury.io/js/%40cleotasks%2Fcore.svg)](https://www.npmjs.com/package/@cleotasks/core)
[![TypeScript](https://badges.frapsoft.com/typescript/code/typescript.svg?v=101)](https://github.com/ellerbrock/typescript-badges/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Cleo is a powerful, TypeScript-first distributed task queue system for Node.js that makes background job processing simple, reliable, and scalable. Inspired by Celery, but built from the ground up for the Node.js ecosystem.

## ✨ Key Features

- **🎯 Distributed Task Processing**
  - Scale across multiple nodes
  - Automatic load balancing
  - Fault tolerance and high availability

- **⚡ High Performance**
  - Concurrent task execution
  - Optimized worker pools
  - Efficient message broker integration

- **🔄 Reliability**
  - Automatic retries with backoff
  - Dead letter queues
  - Transaction support
  - Task persistence

- **📊 Advanced Features**
  - Priority queues
  - Task dependencies
  - Rate limiting
  - Task scheduling (cron)
  - Progress tracking
  - Real-time monitoring

## 🚀 Quick Start

### Installation

```bash
# Install core package
npm install @cleotasks/core

# Install worker package
npm install @cleotasks/worker

# Optional: Install Redis adapter
npm install @cleotasks/redis
```

### Basic Usage

```typescript
import { cleo } from '@cleotasks/core';

// 1. Configure Cleo
cleo.configure({
  broker: {
    type: 'redis',
    url: process.env.REDIS_URL
  },
  workers: {
    concurrency: 5,
    autoStart: true
  }
});

// 2. Define a Task
@cleo.task({
  name: 'process-order',
  queue: 'orders',
  retries: 3
})
async function processOrder(orderId: string) {
  logger.info('Processing order', {
    fileName: 'tasks/orders.ts',
    lineNo: 25,
    functionName: 'processOrder',
    variable: 'orderId',
    value: orderId
  });
  // Order processing logic
}

// 3. Enqueue Tasks
await cleo.enqueue('process-order', '12345', {
  priority: 'high',
  delay: '5m'
});

// 4. Start Processing
cleo.start();
```

## 📚 Documentation

Visit our [comprehensive documentation](https://cleo-docs.vercel.app) for:
- Detailed guides and tutorials
- API reference
- Best practices
- Advanced configuration
- Deployment strategies

## 🎯 Core Features in Detail

### Priority Queues
```typescript
@cleo.task({
  priority: TaskPriority.HIGH,
  queue: 'critical-tasks'
})
async function urgentTask() {
  // High-priority task logic
}
```

### Task Dependencies
```typescript
@cleo.task({
  dependencies: ['validate-payment', 'check-inventory']
})
async function fulfillOrder(orderId: string) {
  // Execute after dependencies complete
}
```

### Scheduling
```typescript
@cleo.task({
  schedule: {
    cron: '0 0 * * *', // Daily at midnight
    timezone: 'UTC'
  }
})
async function dailyCleanup() {
  // Scheduled task logic
}
```

### Progress Tracking
```typescript
@cleo.task({
  enableProgress: true
})
async function processLargeDataset(data: any[]) {
  const total = data.length;
  for (let i = 0; i < total; i++) {
    await processItem(data[i]);
    this.updateProgress((i + 1) / total * 100);
  }
}
```

## 🔧 Configuration

Cleo is highly configurable to meet your specific needs:

```typescript
cleo.configure({
  broker: {
    type: 'redis',
    url: process.env.REDIS_URL,
    prefix: 'cleo:',
    tls: true
  },
  workers: {
    concurrency: 5,
    maxMemory: '1GB',
    gracefulShutdown: true
  },
  monitoring: {
    metrics: true,
    dashboard: {
      port: 3000,
      auth: true
    }
  },
  logging: {
    level: 'info',
    format: 'json',
    destination: 'console'
  }
});
```

## 🧪 Testing

Cleo includes comprehensive testing utilities:

```typescript
import { TestTaskRunner } from '@cleotasks/testing';

describe('Order Processing', () => {
  it('should process orders correctly', async () => {
    const runner = new TestTaskRunner();
    const result = await runner.runTask(processOrder, '12345');
    expect(result.status).toBe('completed');
  });
});
```

## 📊 Monitoring

Built-in monitoring and metrics:

```typescript
// Get queue metrics
const metrics = await cleo.getMetrics();
console.log('Queue Health:', {
  activeJobs: metrics.active,
  waitingJobs: metrics.waiting,
  completedJobs: metrics.completed,
  failedJobs: metrics.failed
});
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

Cleo is [MIT licensed](LICENSE).

## 🌟 Support

- 📚 [Documentation](https://cleo-docs.vercel.app)
- 💬 [Discord Community](https://discord.gg/cleo)
- 🐛 [Issue Tracker](https://github.com/yourusername/cleo/issues)
- 📧 [Email Support](mailto:support@cleo.dev)
