import { createFileRoute } from '@tanstack/react-router'
import { getLogs, getMonkeyLogs } from '~/lib/data'
import { Card, CardContent } from '~/components/ui/card'
import { useState } from 'react'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/logs')({
  loader: async () => {
    const [historyLogs, monkeyLogs] = await Promise.all([
      getLogs({ data: { limit: 200 } }),
      getMonkeyLogs({ data: { limit: 200 } }),
    ])
    return { historyLogs, monkeyLogs }
  },
  component: LogsPage,
})

function groupByJob(logs: any[]) {
  const map = new Map<string, any>()
  for (const l of logs) {
    const id = l.jobId || 'unknown'
    let g = map.get(id)
    if (!g) {
      g = { jobId: id, jobName: l.jobName, workerId: l.workerId, queueName: l.queueName, group: l.group, logs: [] as any[] }
      map.set(id, g)
    } else {
      g.jobName ||= l.jobName
      g.workerId ||= l.workerId
      g.queueName ||= l.queueName
      g.group ||= l.group
    }
    g.logs.push(l)
  }
  for (const g of map.values()) g.logs.reverse()
  return [...map.values()]
}

function LogsPage() {
  const { historyLogs, monkeyLogs } = Route.useLoaderData()
  const [tab, setTab] = useState<'history' | 'monkey'>('history')
  const [expanded, setExpanded] = useState<string | number | null>(null)
  const [openLine, setOpenLine] = useState<string | null>(null)
  const [levelFilter, setLevelFilter] = useState('all')
  const [search, setSearch] = useState('')

  const activeLogs = tab === 'history' ? historyLogs : monkeyLogs

  const filtered = activeLogs.filter((l: any) => {
    const matchesLevel = levelFilter === 'all' || l.level === levelFilter
    const q = search.toLowerCase()
    const matchesSearch =
      !search ||
      (l.taskId || l.jobId || '').toLowerCase().includes(q) ||
      (l.jobName || '').toLowerCase().includes(q) ||
      (l.queueName || '').toLowerCase().includes(q) ||
      (l.message || '').toLowerCase().includes(q) ||
      (l.workerId || '').toLowerCase().includes(q)
    return matchesLevel && matchesSearch
  })

  const monkeyGroups = tab === 'monkey' ? groupByJob(filtered) : []

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-lg font-bold tracking-tight text-foreground uppercase">Logs</h2>
        <p className="text-[11px] text-muted-foreground mt-1 font-mono-data tracking-wide">
          TASK HISTORY & MONKEYCAPTURE RUNTIME LOGS
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => { setTab('history'); setExpanded(null); setOpenLine(null) }}
          className={cn(
            'px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors',
            tab === 'history'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Task History
        </button>
        <button
          onClick={() => { setTab('monkey'); setExpanded(null); setOpenLine(null) }}
          className={cn(
            'px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors',
            tab === 'monkey'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Runtime Logs (MonkeyCapture)
        </button>
      </div>

      <div className="flex gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by task, job ID, worker, or message…"
          className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
        >
          <option value="all">All Levels</option>
          <option value="info">Info</option>
          <option value="error">Error</option>
        </select>
      </div>

      <Card>
        <CardContent className="pt-5">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {tab === 'monkey'
                ? 'No MonkeyCapture logs found. Logs appear here when tasks run with console.log or fetch calls.'
                : 'No log entries found.'}
            </p>
          ) : tab === 'monkey' ? (
            <div className="divide-y divide-border">
              {monkeyGroups.map((g: any) => {
                const open = expanded === g.jobId
                const hasError = g.logs.some((l: any) => l.level === 'error')
                return (
                  <div key={g.jobId}>
                    <button
                      onClick={() => {
                        setExpanded(open ? null : g.jobId)
                        setOpenLine(null)
                      }}
                      className={cn(
                        'w-full text-left px-3 py-3 transition-colors hover:bg-muted/50 cursor-pointer',
                        open && 'bg-muted/30'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className={cn('h-2 w-2 rounded-full shrink-0', hasError ? 'bg-red-500' : 'bg-emerald-500')} />
                        <span className="text-sm text-foreground truncate flex-1 font-medium">
                          {g.jobName || 'unknown task'}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono-data shrink-0">
                          {g.logs.length} {g.logs.length === 1 ? 'event' : 'events'}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono-data shrink-0">
                          {g.logs[0]?.timestamp ? new Date(g.logs[0].timestamp).toLocaleString() : ''}
                        </span>
                      </div>
                      <p className="mt-1 ml-5 text-[10px] text-muted-foreground font-mono-data truncate">
                        {g.jobId}
                        {g.queueName ? ` · ${g.queueName}` : ''}
                        {g.workerId ? ` · ${g.workerId}` : ''}
                        {g.group ? ` · ${g.group}` : ''}
                      </p>
                    </button>
                    {open && (
                      <div className="ml-5 mb-3 mr-3 space-y-1 text-xs font-mono-data text-muted-foreground border-l-2 border-border pl-3">
                        <p><span className="text-foreground">Task:</span> {g.jobName || '—'}</p>
                        <p><span className="text-foreground">Job ID:</span> {g.jobId || '—'}</p>
                        <p><span className="text-foreground">Queue:</span> {g.queueName || '—'}</p>
                        <p><span className="text-foreground">Worker:</span> {g.workerId || '—'}</p>
                        {g.group && <p><span className="text-foreground">Group:</span> {g.group}</p>}
                        <div className="divide-y divide-border mt-2">
                          {g.logs.map((log: any, i: number) => {
                            const lineKey = `${g.jobId}:${i}`
                            const lineOpen = openLine === lineKey
                            return (
                              <button
                                key={lineKey}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenLine(lineOpen ? null : lineKey)
                                }}
                                className="w-full text-left py-2 hover:bg-muted/40 cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', log.level === 'error' ? 'bg-red-500' : 'bg-emerald-500')} />
                                  <span className="text-foreground truncate flex-1">{log.message}</span>
                                  <span className="text-[10px] shrink-0">
                                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                                  </span>
                                </div>
                                {lineOpen && log.functionArgs != null && (
                                  <p className="mt-1 ml-4 break-all">
                                    <span className="text-foreground">Args:</span>{' '}
                                    {typeof log.functionArgs === 'string'
                                      ? log.functionArgs
                                      : JSON.stringify(log.functionArgs)}
                                  </p>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((log: any, i: number) => (
                <button
                  key={i}
                  onClick={() => setExpanded(expanded === i ? null : i)}
                  className={cn(
                    'w-full text-left px-3 py-3 transition-colors hover:bg-muted/50 cursor-pointer',
                    expanded === i && 'bg-muted/30'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full shrink-0',
                        log.level === 'error' ? 'bg-red-500' : 'bg-emerald-500'
                      )}
                    />
                    <span className="text-sm text-foreground truncate flex-1">{log.message}</span>
                    <span className="text-[10px] text-muted-foreground font-mono-data shrink-0">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                    </span>
                  </div>
                  {expanded === i && (
                    <div className="mt-3 ml-5 space-y-1 text-xs font-mono-data text-muted-foreground border-l-2 border-border pl-3">
                      <p><span className="text-foreground">Task ID:</span> {log.taskId || '—'}</p>
                      <p><span className="text-foreground">Worker:</span> {log.workerId || '—'}</p>
                      <p><span className="text-foreground">Queue:</span> {log.queueName || '—'}</p>
                      <p><span className="text-foreground">Status:</span> {log.status || '—'}</p>
                      {typeof log.duration === 'number' && (
                        <p><span className="text-foreground">Duration:</span> {log.duration}ms</p>
                      )}
                      {log.group && <p><span className="text-foreground">Group:</span> {log.group}</p>}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
