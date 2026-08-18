import { createFileRoute } from '@tanstack/react-router'
import { getScheduledJobs } from '~/lib/data'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'

export const Route = createFileRoute('/scheduled')({
  loader: () => getScheduledJobs(),
  component: ScheduledPage,
})

function ScheduledPage() {
  const jobs = Route.useLoaderData()

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-lg font-bold tracking-tight text-foreground uppercase">Scheduled / Cron Jobs</h2>
        <p className="text-[11px] text-muted-foreground mt-1 font-mono-data tracking-wide">
          REPEATABLE JOBS · {jobs.length} REGISTERED
        </p>
      </div>

      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No scheduled jobs found.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {jobs.map((job, i) => (
            <Card key={`${job.queue}-${job.name}-${i}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-primary font-mono-data">{job.name}</CardTitle>
                  <span className="text-[10px] font-mono-data text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {job.queue}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs font-mono-data">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground uppercase tracking-wider">Cron Pattern</span>
                    <span className="text-foreground">{job.pattern ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground uppercase tracking-wider">Next Run</span>
                    <span className="text-foreground">
                      {job.nextRun ? new Date(job.nextRun).toLocaleString() : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground uppercase tracking-wider">Job ID</span>
                    <span className="text-foreground truncate max-w-[200px]">{job.jobId ?? '—'}</span>
                  </div>
                  {job.options?.backoff && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground uppercase tracking-wider">Backoff</span>
                      <span className="text-foreground">
                        {job.options.backoff.type} / {job.options.backoff.delay}ms
                      </span>
                    </div>
                  )}
                  {job.options?.timeout && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground uppercase tracking-wider">Timeout</span>
                      <span className="text-foreground">{job.options.timeout}ms</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
