# Cleo Examples

This directory contains example implementations of the Cleo distributed task queue system. Each example demonstrates different features and use cases of the system.

## Prerequisites

Before running the examples, make sure you have:

1. Redis server running locally (default: localhost:6379)
2. Node.js installed (v18 or higher)
3. Yarn package manager

## Examples Overview

### 1. Basic Task Queue (`basic.ts`)

Demonstrates the basic usage of Cleo for creating and processing tasks:
- Task definition using decorators
- Task configuration (retries, delays, priority)
- Adding multiple tasks to the queue
- Basic error handling

```bash
yarn ts-node examples/basic.ts
```

### 2. Scheduled Tasks (`scheduled.ts`)

Shows how to work with scheduled and periodic tasks:
- Cron-style task scheduling
- Multiple scheduled tasks
- Task scheduling configuration
- Periodic task execution

```bash
yarn ts-node examples/scheduled.ts
```

### 3. Worker Configuration (`worker.ts`)

Illustrates worker setup and configuration:
- Worker configuration options
- Task processing lifecycle
- Progress tracking
- Error handling
- Graceful shutdown
- Logging implementation

```bash
yarn ts-node examples/worker.ts
```

## Running the Examples

1. Start Redis server locally:
```bash
redis-server
```

2. Install dependencies:
```bash
yarn install
```

3. Run any example:
```bash
yarn ts-node examples/<example-file>.ts
```

## Best Practices Demonstrated

1. **Error Handling**: Proper error handling and retries
2. **Logging**: Structured logging with emojis and context
3. **Configuration**: Centralized configuration management
4. **Graceful Shutdown**: Proper cleanup on process termination
5. **Progress Tracking**: Task progress monitoring
6. **Type Safety**: TypeScript types and interfaces

## Notes

- These examples are for demonstration purposes and may need adjustments for production use
- Make sure to handle sensitive information (like Redis credentials) using environment variables in production
- Consider implementing proper monitoring and alerting in production environments 