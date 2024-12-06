# Dockerfile
FROM oven/bun:1.0.15-slim as base
WORKDIR /app
ENV NODE_ENV=production

# Development stage for better DX
FROM base as development
ENV NODE_ENV=development
COPY package*.json bun.lockb ./
COPY packages/core/package*.json ./packages/core/
COPY packages/dashboard/package*.json ./packages/dashboard/
COPY packages/docs/package*.json ./packages/docs/
RUN bun install
COPY . .

# Builder stage for compiling
FROM base as builder
COPY package*.json bun.lockb ./
COPY packages/core/package*.json ./packages/core/
COPY packages/dashboard/package*.json ./packages/dashboard/
COPY packages/docs/package*.json ./packages/docs/
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build:core && \
    bun run build:dashboard && \
    bun run build:docs

# Production stage
FROM base as production
LABEL maintainer="Cleo Team <team@cleo.dev>"
LABEL description="Cleo - Distributed Task Queue System"
LABEL version="2.0.0"

# Install curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r cleo && useradd -r -g cleo cleo
USER cleo

# Copy built files and dependencies
COPY --from=builder --chown=cleo:cleo /app/packages/core/dist ./packages/core/dist
COPY --from=builder --chown=cleo:cleo /app/packages/dashboard/.next ./packages/dashboard/.next
COPY --from=builder --chown=cleo:cleo /app/packages/docs/.next ./packages/docs/.next
COPY --from=builder --chown=cleo:cleo /app/node_modules ./node_modules
COPY --from=builder --chown=cleo:cleo /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=builder --chown=cleo:cleo /app/packages/dashboard/node_modules ./packages/dashboard/node_modules
COPY --from=builder --chown=cleo:cleo /app/packages/docs/node_modules ./packages/docs/node_modules

# Copy package files for scripts
COPY --chown=cleo:cleo package*.json ./
COPY --chown=cleo:cleo packages/core/package*.json ./packages/core/
COPY --chown=cleo:cleo packages/dashboard/package*.json ./packages/dashboard/
COPY --chown=cleo:cleo packages/docs/package*.json ./packages/docs/

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    CORE_PORT=3001 \
    DOCS_PORT=3002

# Expose ports
EXPOSE $PORT $CORE_PORT $DOCS_PORT

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:$CORE_PORT/health || exit 1

# Default command (can be overridden in docker-compose)
CMD ["bun", "run", "start:core"]
