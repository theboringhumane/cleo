import { cn } from '~/lib/utils'

const stateStyles: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  completed: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  failed: 'bg-red-500/10 text-red-400 border-red-500/30',
  waiting: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  delayed: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
  paused: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  stale: 'bg-red-500/10 text-red-400 border-red-500/30',
  unknown: 'bg-gray-500/10 text-gray-500 border-gray-600/30',
}

export function StatusBadge({ state }: { state: string }) {
  const style = stateStyles[state] ?? stateStyles.unknown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
        style
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {state}
    </span>
  )
}
