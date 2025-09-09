#!/bin/bash

# Cleo Worker Startup Script
echo "🚀 Starting Cleo Worker..."

# Check if Redis is running
if ! timeout 3 bash -c "</dev/tcp/localhost/6379" > /dev/null 2>&1; then
    echo "❌ Redis is not running. Please start Redis first:"
    echo "   docker run -d -p 6379:6379 redis:latest"
    echo "   or"
    echo "   brew services start redis"
    exit 1
fi

echo "✅ Redis is running"

# Set default environment variables if not set
export REDIS_HOST=${REDIS_HOST:-localhost}
export REDIS_PORT=${REDIS_PORT:-6379}

echo "📡 Connecting to Redis at $REDIS_HOST:$REDIS_PORT"

# Start the worker
echo "🔄 Starting worker process..."
bun run examples/bun-worker-example.ts
