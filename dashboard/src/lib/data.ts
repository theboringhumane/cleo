import { createServerFn } from '@tanstack/react-start'

// Server-only deps (ioredis, bullmq) are imported DYNAMICALLY inside each
// handler. The TanStack Start compiler strips handler bodies from the client
// bundle, so these never ship to the browser.

export interface QueueSummary {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: number
  createdAt?: string
  lastActivity?: string
}

export interface WorkerSummary {
  id: string
  queue: string
  status: string
  lastHeartbeat: string | null
  activeTasks: string[]
  metrics: {
    tasksProcessed: number
    tasksSucceeded: number
    tasksFailed: number
    averageProcessingTime: number
  }
}

export interface TaskSummary {
  id: string
  name: string
  queue: string
  state: string
  attemptsMade: number
  timestamp: number
  group?: string | null
  failedReason?: string | null
  stacktrace?: string[] | null
  returnvalue?: string | null
  processedOn?: number | null
  finishedOn?: number | null
}

export interface LogEntry {
  timestamp: string
  level: string
  message: string
  taskId?: string
  workerId?: string
  queueName?: string
  status?: string
  duration?: number
  group?: string
}

export interface GroupSummary {
  name: string
  total: number
  active: number
  completed: number
  failed: number
  paused: number
}

export interface ScheduledJob {
  queue: string
  name: string
  pattern: string | null
  nextRun: string | null
  nextRunTs: number | null
  jobId: string | null
  options: any
  data: any
}

export interface MonkeyLogEntry {
  workerId: string
  jobId: string
  jobName?: string
  queueName?: string
  group?: string
  timestamp: string
  level: string
  message: string
  functionArgs?: any
}

export const getOverview = createServerFn({ method: 'GET' }).handler(async () => {
  const { getRedis, KEYS, bullConnection, safeParse } = await import('./redis.server')
  const { Queue } = await import('bullmq')
  const redis = getRedis()

  const queueNames = await redis.smembers(KEYS.QUEUES_SET)
  const workerIds = await redis.smembers(KEYS.WORKERS_SET)

  let totalWaiting = 0
  let totalActive = 0
  let totalCompleted = 0
  let totalFailed = 0

  for (const name of queueNames) {
    try {
      const q = new Queue(name, { connection: bullConnection() })
      const counts = await q.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed')
      totalWaiting += counts.waiting || 0
      totalActive += counts.active || 0
      totalCompleted += counts.completed || 0
      totalFailed += counts.failed || 0
      await q.close()
    } catch {
      // queue unreachable; skip
    }
  }

  const history = await redis.lrange(`${KEYS.TASK_HISTORY_KEY}global`, 0, 0)
  const lastEvent = history.length ? safeParse(history[0]) : null

  return {
    queueCount: queueNames.length,
    workerCount: workerIds.length,
    totalWaiting,
    totalActive,
    totalCompleted,
    totalFailed,
    lastEvent,
  }
})

export const getQueues = createServerFn({ method: 'GET' }).handler(async () => {
  const { getRedis, KEYS, bullConnection } = await import('./redis.server')
  const { Queue } = await import('bullmq')
  const redis = getRedis()

  const queueNames = await redis.smembers(KEYS.QUEUES_SET)
  const results: QueueSummary[] = []

  for (const name of queueNames) {
    const meta = await redis.hgetall(`${KEYS.QUEUE_META_PREFIX}${name}`)
    let counts: Record<string, number> = {
      waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0,
    }
    try {
      const q = new Queue(name, { connection: bullConnection() })
      counts = await q.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused')
      await q.close()
    } catch {
      // leave zeros
    }
    results.push({
      name,
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
      paused: counts.paused || 0,
      createdAt: meta.createdAt ? new Date(parseInt(meta.createdAt)).toISOString() : undefined,
      lastActivity: meta.lastActivity ? new Date(parseInt(meta.lastActivity)).toISOString() : undefined,
    })
  }

  return results
})

export const getQueueDetail = createServerFn({ method: 'GET' })
  .validator((d: { queueName: string }) => d)
  .handler(async ({ data }) => {
    const { bullConnection } = await import('./redis.server')
    const { Queue } = await import('bullmq')
    const { queueName } = data
    const q = new Queue(queueName, { connection: bullConnection() })
    try {
      const counts = await q.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused')
      const jobs = await q.getJobs(['waiting', 'active', 'delayed', 'failed', 'completed'], 0, 50)
      const tasks: TaskSummary[] = []
      for (const j of jobs) {
        tasks.push({
          id: j.id ?? '',
          name: j.name,
          queue: queueName,
          state: await j.getState(),
          attemptsMade: j.attemptsMade,
          timestamp: j.timestamp,
          group: j.data?.options?.group ?? null,
          failedReason: j.failedReason ?? null,
          stacktrace: j.stacktrace?.length ? j.stacktrace : null,
          returnvalue: j.returnvalue != null ? String(j.returnvalue) : null,
          processedOn: j.processedOn ?? null,
          finishedOn: j.finishedOn ?? null,
        })
      }
      return { name: queueName, counts, tasks }
    } finally {
      await q.close()
    }
  })

export const getWorkers = createServerFn({ method: 'GET' }).handler(async () => {
  const { getRedis, KEYS } = await import('./redis.server')
  const redis = getRedis()

  const workerIds = await redis.smembers(KEYS.WORKERS_SET)
  const results: WorkerSummary[] = []

  for (const id of workerIds) {
    const status = (await redis.get(`${KEYS.WORKER_KEY}:${id}:status`)) || 'unknown'
    const lastHeartbeat = await redis.get(`${KEYS.WORKER_KEY}:${id}:lastHeartbeat`)
    const activeTasks = await redis.smembers(`${KEYS.WORKER_KEY}:${id}:activeTasks`)
    const metricsRaw = await redis.hgetall(`${KEYS.WORKER_KEY}:${id}:metrics`)
    const tasksProcessed = parseInt(metricsRaw.tasksProcessed || '0')
    const totalProcessingTime = parseInt(metricsRaw.totalProcessingTime || '0')

    let queue = 'unknown'
    const queueKeys = await redis.keys(`${KEYS.QUEUE_WORKERS_PREFIX}*`)
    for (const qk of queueKeys) {
      const members = await redis.smembers(qk)
      if (members.includes(id)) {
        queue = qk.replace(KEYS.QUEUE_WORKERS_PREFIX, '')
        break
      }
    }

    results.push({
      id,
      queue,
      status,
      lastHeartbeat,
      activeTasks,
      metrics: {
        tasksProcessed,
        tasksSucceeded: parseInt(metricsRaw.tasksSucceeded || '0'),
        tasksFailed: parseInt(metricsRaw.tasksFailed || '0'),
        averageProcessingTime: tasksProcessed > 0 ? totalProcessingTime / tasksProcessed : 0,
      },
    })
  }

  return results
})

export const getTasks = createServerFn({ method: 'GET' }).handler(async () => {
  const { getRedis, KEYS, bullConnection } = await import('./redis.server')
  const { Queue } = await import('bullmq')
  const redis = getRedis()

  const queueNames = await redis.smembers(KEYS.QUEUES_SET)
  const all: TaskSummary[] = []

  for (const name of queueNames) {
    try {
      const q = new Queue(name, { connection: bullConnection() })
      const jobs = await q.getJobs(['waiting', 'active', 'delayed', 'failed', 'completed'], 0, 100)
      for (const j of jobs) {
        all.push({
          id: j.id ?? '',
          name: j.name,
          queue: name,
          state: await j.getState(),
          attemptsMade: j.attemptsMade,
          timestamp: j.timestamp,
          group: j.data?.options?.group ?? null,
        })
      }
      await q.close()
    } catch {
      // skip unreachable queue
    }
  }

  all.sort((a, b) => b.timestamp - a.timestamp)
  return all
})

export const getLogs = createServerFn({ method: 'GET' })
  .validator((d?: { limit?: number }) => d ?? {})
  .handler(async ({ data }) => {
    const { getRedis, KEYS, safeParse } = await import('./redis.server')
    const redis = getRedis()
    const limit = data.limit ?? 200

    const raw = await redis.lrange(`${KEYS.TASK_HISTORY_KEY}global`, 0, limit - 1)
    return raw
      .map((r) => safeParse(r))
      .filter(Boolean)
      .map((e: any): LogEntry => ({
        timestamp: e.timestamp,
        level: e.status === 'failed' ? 'error' : 'info',
        message: `${e.status} — ${e.taskId} (${e.queueName || 'unknown queue'})`,
        taskId: e.taskId,
        workerId: e.workerId,
        queueName: e.queueName,
        status: e.status,
        duration: e.duration,
        group: e.group,
      }))
  })

export const getGroups = createServerFn({ method: 'GET' }).handler(async () => {
  const { getRedis, KEYS } = await import('./redis.server')
  const redis = getRedis()

  const keys = await redis.keys(`${KEYS.GROUP_PREFIX}*:tasks`)
  const results: GroupSummary[] = []

  for (const key of keys) {
    const groupName = key.split(':')[1]
    const members = await redis.smembers(key)
    const stateMap = await redis.hgetall(`${KEYS.GROUP_PREFIX}${groupName}:state`)
    const stats: GroupSummary = {
      name: groupName,
      total: members.length,
      active: 0,
      completed: 0,
      failed: 0,
      paused: 0,
    }
    for (const status of Object.values(stateMap)) {
      if (status === 'active') stats.active++
      else if (status === 'completed') stats.completed++
      else if (status === 'failed') stats.failed++
      else if (status === 'paused') stats.paused++
    }
    results.push(stats)
  }

  return results
})

export const getScheduledJobs = createServerFn({ method: 'GET' }).handler(async () => {
  const { getRedis, safeParse } = await import('./redis.server')
  const redis = getRedis()

  const repeatKeys = await redis.keys('bull:*:repeat')
  const results: ScheduledJob[] = []

  for (const key of repeatKeys) {
    const queueName = key.split(':')[1]
    const members = await redis.zrange(key, 0, -1, 'WITHSCORES')

    for (let i = 0; i < members.length; i += 2) {
      const jobName = members[i]
      const nextRunTs = parseInt(members[i + 1], 10)
      const hashKey = `bull:${queueName}:repeat:${jobName}`
      const details = await redis.hgetall(hashKey)

      const opts = safeParse(details.opts) || {}
      const data = safeParse(details.data) || {}

      results.push({
        queue: queueName,
        name: details.name || jobName,
        pattern: details.pattern || opts?.repeat?.pattern || null,
        nextRun: nextRunTs ? new Date(nextRunTs).toISOString() : null,
        nextRunTs,
        jobId: opts?.repeat?.jobId || opts?.jobId || jobName,
        options: opts,
        data,
      })
    }
  }

  results.sort((a, b) => (a.nextRunTs ?? 0) - (b.nextRunTs ?? 0))
  return results
})

export const getMonkeyLogs = createServerFn({ method: 'GET' })
  .validator((d?: { limit?: number }) => d ?? {})
  .handler(async ({ data }) => {
    const { getRedis, KEYS, safeParse } = await import('./redis.server')
    const redis = getRedis()
    const limit = data.limit ?? 200

    const logKeys = await redis.keys(`${KEYS.WORKER_KEY}:*:task:*:logs`)
    const entries: MonkeyLogEntry[] = []
    const asId = (v: unknown) =>
      typeof v === 'string' && v !== 'undefined' && v !== 'null' && v.length > 0 ? v : undefined

    for (const key of logKeys) {
      const prefix = `${KEYS.WORKER_KEY}:`
      if (!key.startsWith(prefix) || !key.endsWith(':logs')) continue
      const mid = key.slice(prefix.length, -':logs'.length)
      const sep = ':task:'
      const sepAt = mid.indexOf(sep)
      if (sepAt < 0) continue
      const workerIdFromKey = mid.slice(0, sepAt)
      const jobIdFromKey = mid.slice(sepAt + sep.length)

      const raw = await redis.lrange(key, 0, limit - 1)
      for (const r of raw) {
        const parsed = safeParse(r)
        if (parsed) {
          entries.push({
            workerId: asId(parsed.workerId) || asId(workerIdFromKey) || '',
            jobId: asId(parsed.jobId) || asId(jobIdFromKey) || '',
            jobName: asId(parsed.jobName),
            queueName: asId(parsed.queueName),
            group: asId(parsed.group),
            timestamp: parsed.timestamp,
            level: parsed.level || 'info',
            message: parsed.message || '',
            functionArgs: parsed.functionArgs,
          })
        }
      }
    }

    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return entries.slice(0, limit)
  })

export interface DayActivity {
  label: string
  completed: number
  failed: number
}

export const getActivitySeries = createServerFn({ method: 'GET' }).handler(async () => {
  const { getRedis, KEYS, safeParse } = await import('./redis.server')
  const redis = getRedis()

  const raw = await redis.lrange(`${KEYS.TASK_HISTORY_KEY}global`, 0, 999)
  const dayMs = 86400000
  const buckets = new Map<number, { completed: number; failed: number }>()

  for (let day = 6; day >= 0; day--) {
    const dayStart = Math.floor((Date.now() - day * dayMs) / dayMs)
    buckets.set(dayStart, { completed: 0, failed: 0 })
  }

  for (const r of raw) {
    const e = safeParse(r)
    if (!e?.timestamp) continue
    const dayStart = Math.floor(new Date(e.timestamp).getTime() / dayMs)
    const bucket = buckets.get(dayStart)
    if (!bucket) continue
    if (e.status === 'completed') bucket.completed++
    else if (e.status === 'failed') bucket.failed++
  }

  const days: DayActivity[] = []
  for (let day = 6; day >= 0; day--) {
    const dayStartMs = Date.now() - day * dayMs
    const key = Math.floor(dayStartMs / dayMs)
    const bucket = buckets.get(key) || { completed: 0, failed: 0 }
    days.push({
      label: new Date(dayStartMs).toLocaleDateString('en-US', { weekday: 'short' }),
      completed: bucket.completed,
      failed: bucket.failed,
    })
  }

  return { days }
})
