import { createFileRoute } from '@tanstack/react-router'
import { getWorkers } from '~/lib/data'
import { StatusBadge } from '~/components/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'

export const Route = createFileRoute('/workers')({
  loader: () => getWorkers(),
  component: WorkersPage,
})

function heartbeatAge(ts: string | null): { label: string; stale: boolean } {
  if (!ts) return { label: 'never', stale: true }
  const ms = Date.now() - parseInt(ts, 10)
  if (ms < 15_000) return { label: `${Math.round(ms / 1000)}s ago`, stale: false }
  if (ms < 60_000) return { label: `${Math.round(ms / 1000)}s ago`, stale: true }
  if (ms < 3_600_000) return { label: `${Math.round(ms / 60_000)}m ago`, stale: true }
  return { label: `${Math.round(ms / 3_600_000)}h ago`, stale: true }
}

function WorkersPage() {
  const workers = Route.useLoaderData()

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-lg font-bold tracking-tight text-foreground uppercase">Workers</h2>
        <p className="text-[11px] text-muted-foreground mt-1 font-mono-data tracking-wide">
          REGISTERED WORKERS · {workers.length} TOTAL
        </p>
      </div>

      {workers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No workers registered.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {workers.map((w) => {
            const hb = heartbeatAge(w.lastHeartbeat)
            return (
              <Card key={w.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono-data text-[11px] text-muted-foreground truncate" title={w.id}>
                        {w.id}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        queue: <span className="text-foreground">{w.queue}</span>
                      </p>
                    </div>
                    <StatusBadge state={hb.stale ? 'stale' : w.status} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="rounded bg-muted/50 px-2 py-1.5">
                      <p className="text-sm font-semibold tabular-nums text-foreground">{w.metrics.tasksProcessed}</p>
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Processed</p>
                    </div>
                    <div className="rounded bg-muted/50 px-2 py-1.5">
                      <p className="text-sm font-semibold tabular-nums text-emerald-400">{w.metrics.tasksSucceeded}</p>
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Success</p>
                    </div>
                    <div className="rounded bg-muted/50 px-2 py-1.5">
                      <p className="text-sm font-semibold tabular-nums text-red-400">{w.metrics.tasksFailed}</p>
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Failed</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-[11px] text-muted-foreground font-mono-data">
                    <p>
                      avg: <span className="text-foreground">{w.metrics.averageProcessingTime.toFixed(0)}ms</span>
                    </p>
                    <p>
                      heartbeat:{' '}
                      <span className={hb.stale ? 'text-red-400' : 'text-emerald-400'}>{hb.label}</span>
                    </p>
                    <p>
                      active tasks: <span className="text-foreground">{w.activeTasks.length}</span>
                    </p>
                  </div>
                  {w.activeTasks.length > 0 && (
                    <div className="mt-2 border-t border-border pt-2">
                      {w.activeTasks.map((t) => (
                        <p key={t} className="font-mono-data text-[10px] text-emerald-300 truncate">▸ {t}</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
