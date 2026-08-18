import { createFileRoute } from '@tanstack/react-router'
import { getGroups, getTasks } from '~/lib/data'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'

export const Route = createFileRoute('/groups')({
  loader: async () => {
    const [groups, tasks] = await Promise.all([getGroups(), getTasks()])
    return { groups, tasks }
  },
  component: GroupsPage,
})

function GroupsPage() {
  const { groups, tasks } = Route.useLoaderData()

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-lg font-bold tracking-tight text-foreground uppercase">Groups</h2>
        <p className="text-[11px] text-muted-foreground mt-1 font-mono-data tracking-wide">
          TASK GROUPS · {groups.length} TOTAL
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No groups found.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => {
            const members = tasks.filter((t) => t.group === g.name)
            return (
              <Card key={g.name}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-primary font-mono-data">{g.name}</CardTitle>
                    <span className="text-[10px] text-muted-foreground font-mono-data">{g.total} tasks</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-2 text-center mb-3">
                    <div className="rounded bg-emerald-500/10 px-2 py-1.5">
                      <p className="text-sm font-semibold text-emerald-400 tabular-nums">{g.active}</p>
                      <p className="text-[9px] uppercase text-muted-foreground">Active</p>
                    </div>
                    <div className="rounded bg-sky-500/10 px-2 py-1.5">
                      <p className="text-sm font-semibold text-sky-400 tabular-nums">{g.completed}</p>
                      <p className="text-[9px] uppercase text-muted-foreground">Done</p>
                    </div>
                    <div className="rounded bg-red-500/10 px-2 py-1.5">
                      <p className="text-sm font-semibold text-red-400 tabular-nums">{g.failed}</p>
                      <p className="text-[9px] uppercase text-muted-foreground">Failed</p>
                    </div>
                    <div className="rounded bg-amber-500/10 px-2 py-1.5">
                      <p className="text-sm font-semibold text-amber-400 tabular-nums">
                        {Math.max(0, g.total - g.active - g.completed - g.failed - g.paused)}
                      </p>
                      <p className="text-[9px] uppercase text-muted-foreground">Waiting</p>
                    </div>
                  </div>
                  {members.length > 0 && (
                    <div className="border-t border-border pt-2 space-y-1">
                      {members.slice(0, 8).map((m) => (
                        <div key={m.id} className="flex items-center gap-2 text-[11px]">
                          <span
                            className={
                              'h-1.5 w-1.5 rounded-full shrink-0 ' +
                              (m.state === 'active'
                                ? 'bg-emerald-400'
                                : m.state === 'completed'
                                  ? 'bg-sky-400'
                                  : m.state === 'failed'
                                    ? 'bg-red-400'
                                    : 'bg-amber-400')
                            }
                          />
                          <span className="font-mono-data text-muted-foreground truncate">{m.id}</span>
                          <span className="text-gray-500 ml-auto capitalize">{m.state}</span>
                        </div>
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
