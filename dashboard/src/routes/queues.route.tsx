import { createFileRoute, Link } from '@tanstack/react-router'
import { getQueues } from '~/lib/data'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'

export const Route = createFileRoute('/queues')({
  loader: () => getQueues(),
  component: QueuesPage,
})

function QueuesPage() {
  const queues = Route.useLoaderData()

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-lg font-bold tracking-tight text-foreground uppercase">Queues</h2>
        <p className="text-[11px] text-muted-foreground mt-1 font-mono-data tracking-wide">
          REGISTERED BULLMQ QUEUES · {queues.length} TOTAL
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Queues</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Queue Name</TableHead>
                <TableHead className="text-right">Waiting</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Delayed</TableHead>
                <TableHead className="text-right">Paused</TableHead>
                <TableHead>Last Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queues.map((q) => (
                <TableRow key={q.name}>
                  <TableCell>
                    <Link
                      to="/queues/$queueName"
                      params={{ queueName: q.name }}
                      className="font-mono-data text-xs text-primary hover:underline"
                    >
                      {q.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-amber-400">{q.waiting}</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-400">{q.active}</TableCell>
                  <TableCell className="text-right tabular-nums text-sky-400">{q.completed}</TableCell>
                  <TableCell className="text-right tabular-nums text-red-400">{q.failed}</TableCell>
                  <TableCell className="text-right tabular-nums text-violet-400">{q.delayed}</TableCell>
                  <TableCell className="text-right tabular-nums text-gray-400">{q.paused}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground font-mono-data">
                    {q.lastActivity ? new Date(q.lastActivity).toLocaleString() : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
