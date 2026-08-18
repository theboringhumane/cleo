import { createFileRoute, Link } from '@tanstack/react-router'
import { getQueueDetail } from '~/lib/data'
import { StatusBadge } from '~/components/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { useState, Fragment } from 'react'

export const Route = createFileRoute('/queues_/$queueName')({
  loader: ({ params }) => getQueueDetail({ data: { queueName: params.queueName } }),
  component: QueueDetailPage,
})

function QueueDetailPage() {
  const { queueName } = Route.useParams()
  const detail = Route.useLoaderData()
  const [expandedJob, setExpandedJob] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <Link to="/queues" className="text-[10px] text-muted-foreground hover:text-foreground font-mono-data tracking-wider uppercase">
          ← All Queues
        </Link>
        <h2 className="text-lg font-bold tracking-tight text-foreground mt-1">
          <span className="text-muted-foreground uppercase text-xs mr-2">Queue:</span>
          <span className="text-primary font-mono-data">{queueName}</span>
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
        {(['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'] as const).map((k) => (
          <div key={k} className="rounded border border-border bg-card px-3 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
            <p className="text-lg font-semibold tabular-nums font-mono-data text-foreground mt-0.5">
              {detail.counts[k] ?? 0}
            </p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Jobs ({detail.tasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.tasks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No jobs in this queue.</p>
              <p className="text-xs text-muted-foreground/60 mt-1 font-mono-data">
                Jobs will appear here once tasks are added.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.tasks.map((t) => (
                  <Fragment key={t.id}>
                    <TableRow
                      className={t.failedReason ? 'cursor-pointer' : ''}
                      onClick={() => t.failedReason && setExpandedJob(expandedJob === t.id ? null : t.id)}
                    >
                      <TableCell className="font-mono-data text-[11px] text-muted-foreground max-w-[180px] truncate">{t.id}</TableCell>
                      <TableCell className="text-foreground text-xs">{t.name}</TableCell>
                      <TableCell><StatusBadge state={t.state} /></TableCell>
                      <TableCell className="text-muted-foreground text-xs">{t.group ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{t.attemptsMade}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground font-mono-data">
                        {new Date(t.timestamp).toLocaleString()}
                      </TableCell>
                    </TableRow>
                    {t.failedReason && expandedJob === t.id && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-red-500/5 border-l-2 border-l-red-500/50">
                          <div className="py-2 px-2">
                            <p className="text-xs font-semibold text-red-400 mb-1">Error:</p>
                            <p className="text-xs text-red-300 font-mono-data">{t.failedReason}</p>
                            {t.stacktrace && t.stacktrace.length > 0 && (
                              <pre className="mt-2 text-[10px] text-muted-foreground overflow-x-auto whitespace-pre-wrap font-mono-data max-h-40 overflow-y-auto">
                                {t.stacktrace.join('\n')}
                              </pre>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
