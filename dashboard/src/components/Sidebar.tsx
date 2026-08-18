import { Link, useRouterState } from '@tanstack/react-router'
import { cn } from '~/lib/utils'

const navItems = [
  { to: '/' as const, label: 'Overview', icon: '◉' },
  { to: '/queues' as const, label: 'Queues', icon: '☰' },
  { to: '/tasks' as const, label: 'Tasks', icon: '⚙' },
  { to: '/scheduled' as const, label: 'Scheduled', icon: '⟳' },
  { to: '/workers' as const, label: 'Workers', icon: '⬡' },
  { to: '/groups' as const, label: 'Groups', icon: '⊞' },
  { to: '/logs' as const, label: 'Logs', icon: '≡' },
]

export function Sidebar() {
  const state = useRouterState()
  const currentPath = state.location.pathname

  return (
    <aside className="w-52 shrink-0 border-r border-border bg-card flex flex-col">
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <h1 className="text-sm font-bold tracking-[0.2em] uppercase text-foreground">
            Cleo
          </h1>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 font-mono-data tracking-wider uppercase">
          Task Control Panel
        </p>
      </div>
      <nav className="flex-1 py-4 space-y-0.5 px-2">
        {navItems.map((item) => {
          const isActive =
            item.to === '/'
              ? currentPath === '/'
              : currentPath.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded text-[11px] font-semibold tracking-widest uppercase transition-colors border',
                isActive
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent'
              )}
            >
              <span className="text-xs leading-none opacity-60">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="px-4 py-3 border-t border-border">
        <p className="text-[10px] text-muted-foreground font-mono-data tracking-wider">
          @CLEOTASKS/CORE
        </p>
      </div>
    </aside>
  )
}
