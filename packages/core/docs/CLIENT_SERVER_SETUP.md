# Cleo Client-Server Setup

This guide shows how to set up Cleo in a client-server architecture where:
- **Client** (NextJS/Express): Schedules jobs using decorators and `addTask()`
- **Server** (Bun Worker): Processes jobs from Redis queues

## Architecture Overview

```
┌─────────────────────────────────┐
│         NEXTJS CLIENT           │
│                                 │
│  ┌─────────────────────────────┐│
│  │     CleoClient Mode         ││
│  │                             ││
│  │  @task decorators           ││
│  │  queueManager.addTask()     ││
│  │  (No Workers)               ││
│  └─────────────────────────────┘│
└─────────────────────────────────┘
                 │
                 │ Redis Queue
                 ▼
┌─────────────────────────────────┐
│      REDIS (Shared Queue)       │
│                                 │
│  • Job Storage                  │
│  • Task Groups                  │
│  • Metrics                      │
└─────────────────────────────────┘
                 │
                 │ Poll for Jobs
                 ▼
┌─────────────────────────────────┐
│     BUN BACKGROUND PROCESS      │
│                                 │
│  ┌─────────────────────────────┐│
│  │     CleoWorker Mode         ││
│  │                             ││
│  │  • Job Processors           ││
│  │  • Task Handlers            ││
│  │  • Auto-scaling             ││
│  └─────────────────────────────┘│
└─────────────────────────────────┘
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install cleo-core
# or
bun add cleo-core
```

### 2. Configure Redis

Make sure you have Redis running and accessible to both client and server:

```bash
# Using Docker
docker run -d -p 6379:6379 redis:alpine

# Or install locally
# macOS: brew install redis
# Ubuntu: sudo apt install redis-server
```

### 3. Client Setup (NextJS/Express)

Create a client configuration file:

```typescript
// lib/cleo-client.ts
import { CleoClient } from 'cleo-core';

export const cleo = CleoClient.getInstance();

// Configure once in your app
cleo.configure({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
});
```

Use in your API routes or services:

```typescript
// app/api/send-email/route.ts
import { cleo } from '@/lib/cleo-client';
import { task } from 'cleo-core';
import { TaskPriority } from 'cleo-core';

class EmailService {
  @task({
    priority: TaskPriority.HIGH,
    queue: 'email',
    group: 'notifications',
    timeout: 30000,
    maxRetries: 3,
  })
  async sendWelcomeEmail(userId: string, email: string): Promise<void> {
    // This will be queued, not executed immediately
    console.log(`Sending welcome email to ${email}`);
  }
}

export async function POST(request: Request) {
  const { userId, email } = await request.json();
  
  const emailService = new EmailService();
  await emailService.sendWelcomeEmail(userId, email);
  
  return Response.json({ 
    success: true, 
    message: 'Email queued successfully' 
  });
}
```

### 4. Server Setup (Bun Worker)

Create a worker process:

```typescript
// worker.ts
import { CleoWorker } from 'cleo-core';
import { logger } from 'cleo-core';

const cleo = CleoWorker.getInstance();

// Configure worker
cleo.configure({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  worker: {
    concurrency: 5, // Process up to 5 jobs concurrently
  },
});

// Register task handlers
class EmailHandlers {
  async sendWelcomeEmail(userId: string, email: string): Promise<void> {
    logger.info('📧 Processing welcome email', { userId, email });
    
    // Your actual email sending logic here
    await sendEmail(email, 'Welcome!', 'Welcome to our service!');
    
    console.log(`✅ Welcome email sent to ${email}`);
  }
}

const emailHandlers = new EmailHandlers();

// Register handlers
cleo.registerTaskHandler(
  'send-welcome-email', 
  emailHandlers.sendWelcomeEmail.bind(emailHandlers), 
  'email'
);

// Start processing
await cleo.startProcessing();

console.log('🚀 Worker started and processing jobs...');
```

### 5. Running the Setup

**Start the worker process:**
```bash
bun run worker.ts
# or for development with auto-restart
bun run --watch worker.ts
```

**Start your NextJS app:**
```bash
npm run dev
# or
bun run dev
```

## Key Features

### Client Mode (CleoClient)
- ✅ Schedule jobs using `@task` decorators
- ✅ Use `queueManager.addTask()` directly
- ✅ Schedule group tasks
- ✅ No workers (jobs are queued only)
- ✅ Lightweight and fast

### Worker Mode (CleoWorker)
- ✅ Process jobs from Redis queues
- ✅ Register task handlers
- ✅ Auto-scaling and concurrency control
- ✅ Health monitoring
- ✅ Graceful shutdown

### Shared Features
- ✅ Task groups and priorities
- ✅ Retry logic and timeouts
- ✅ Metrics and monitoring
- ✅ Redis-based coordination

## Environment Variables

```bash
# Required
REDIS_HOST=localhost
REDIS_PORT=6379

# Optional
REDIS_PASSWORD=your_password
REDIS_DB=0
```

## Monitoring

### Check Worker Status
```typescript
// In your worker
const status = await cleo.getWorkerStatus('email');
console.log('Worker status:', status);
```

### Check Queue Metrics
```typescript
// In your client
const metrics = await cleo.getQueueManager().getQueueMetrics('email');
console.log('Queue metrics:', metrics);
```

## Production Considerations

1. **Scaling**: Run multiple worker processes for high throughput
2. **Monitoring**: Use the built-in metrics and health checks
3. **Error Handling**: Implement proper error handling in task handlers
4. **Resource Management**: Monitor memory and CPU usage
5. **Redis Configuration**: Use Redis Cluster for high availability

## Example Project Structure

```
my-app/
├── app/
│   └── api/
│       └── send-email/
│           └── route.ts
├── lib/
│   └── cleo-client.ts
├── worker/
│   └── index.ts
├── package.json
└── .env
```

This setup provides a clean separation between job scheduling (client) and job processing (worker), making it easy to scale and maintain.
