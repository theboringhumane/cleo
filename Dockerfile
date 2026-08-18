# Cleo — single container: backend (SSR server fns) + frontend (dashboard).
# The TanStack Start server doubles as the API (server functions talk to Redis
# directly), so one container serves both.

FROM oven/bun:1-slim AS base
WORKDIR /app

# ---------- deps (workspace install at root) ----------
FROM base AS deps
COPY package.json bun.lockb ./
COPY dashboard/package.json ./dashboard/
COPY packages/core/package.json ./packages/core/
RUN bun install --frozen-lockfile

# ---------- build ----------
FROM deps AS build
COPY dashboard ./dashboard
RUN cd dashboard && bun run build

# ---------- runtime ----------
FROM base AS production
LABEL maintainer="Cleo Team <team@cleo.dev>"
LABEL description="Cleo Dashboard — BullMQ/Cleo control plane"

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    REDIS_HOST=redis \
    REDIS_PORT=6379

# Built app + runner + production node_modules (resolved from dashboard upward)
COPY --from=build --chown=bun:bun /app/dashboard/dist /app/dashboard/dist
COPY --from=build --chown=bun:bun /app/dashboard/server-runner.mjs /app/dashboard/server-runner.mjs
COPY --from=build --chown=bun:bun /app/dashboard/package.json /app/dashboard/package.json
COPY --from=deps --chown=bun:bun /app/node_modules /app/node_modules

EXPOSE 3000

USER bun

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

WORKDIR /app/dashboard
CMD ["bun", "run", "server-runner.mjs"]
