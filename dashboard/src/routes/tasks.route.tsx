import { createFileRoute } from '@tanstack/react-router'
import { getTasks } from '~/lib/data'
import { StatusBadge } from '~/components/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { useState } from 'react'

export const Route = createFileRoute('/tasks')({
  loader: () => getTasks(),
  component: TasksPage,
})

function TasksPage() {
  const tasks = Route.useLoaderData()
  const [filter, setFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('all')

  const filtered = tasks.filter((t) => {
    const matchesText =
      !filter ||
      t.id.toLowerCase().includes(filter.toLowerCase()) ||
      t.name.toLowerCase().includes(filter.toLowerCase()) ||
      (t.group || '').toLowerCase().includes(filter.toLowerCase())
    const matchesState = stateFilter === 'all' || t.state === stateFilter
    return matchesText && matchesState
  })

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-lg font-bold tracking-tight text-foreground uppercase">Tasks</h2>
        <p className="text-[11px] text-muted-foreground mt-1 font-mono-data tracking-wide">
          ALL JOBS ACROSS ALL QUEUES · {tasks.length} TOTAL
        </p>
      </div>

      <div className="flex gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by ID, name, or group…"
          className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
        >
          <option value="all">All States</option>
          <option value="waiting">Waiting</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="delayed">Delayed</option>
        </select>
      </div>

      <Card>
        <CardContent className="pt-5">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No tasks match the current filter.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Queue</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 100).map((t) => (
                  <TableRow key={`${t.queue}:${t.id}`}>
                    <TableCell className="font-mono-data text-[11px] text-muted-foreground max-w-[160px] truncate">{t.id}</TableCell>
                    <TableCell className="text-foreground text-xs">{t.name}</TableCell>
                    <TableCell className="font-mono-data text-xs text-muted-foreground">{t.queue}</TableCell>
                    <TableCell><StatusBadge state={t.state} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t.group ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{t.attemptsMade}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground font-mono-data">
                      {new Date(t.timestamp).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
