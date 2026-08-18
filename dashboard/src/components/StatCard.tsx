import { cn } from '~/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  accent?: 'primary' | 'success' | 'warning' | 'destructive' | 'info' | 'neutral'
}

const accentMap: Record<string, string> = {
  primary: 'border-l-primary text-primary',
  success: 'border-l-emerald-500 text-emerald-400',
  warning: 'border-l-amber-500 text-amber-400',
  destructive: 'border-l-red-500 text-red-400',
  info: 'border-l-sky-500 text-sky-400',
  neutral: 'border-l-muted-foreground text-foreground',
}

export function StatCard({ label, value, accent = 'neutral' }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded border border-border border-l-2 bg-card px-4 py-3',
        accentMap[accent]
      )}
    >
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 font-medium">
        {label}
      </p>
      <p className="text-xl font-semibold tabular-nums font-mono-data">{value}</p>
    </div>
  )
}
