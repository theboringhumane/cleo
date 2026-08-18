import { createFileRoute, Link } from '@tanstack/react-router'
import { getOverview, getQueues, getScheduledJobs, getActivitySeries } from '~/lib/data'
import { MapScene } from '~/components/MapScene'
import { useState } from 'react'
import {
  LayoutGrid,
  Users,
  Clock,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Wind,
  Activity,
  Search,
  Server,
  Gauge,
} from 'lucide-react'

export const Route = createFileRoute('/')({
  loader: async () => {
    const [overview, queues, scheduled, activity] = await Promise.all([
      getOverview(),
      getQueues(),
      getScheduledJobs(),
      getActivitySeries(),
    ])
    return { overview, queues, scheduled, activity }
  },
  component: OverviewPage,
})

function GlassCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`pointer-events-auto rounded-xl border border-[#16283a] bg-[#0a121e]/85 backdrop-blur-md shadow-2xl shadow-black/50 ${className}`}
    >
      {children}
    </div>
  )
}

function CardHeader({ title, right, icon }: { title: string; right?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-2">
      <div className="flex items-center gap-2 text-slate-300 text-sm font-medium">
        {icon}
        {title}
      </div>
      {right}
    </div>
  )
}

/* ---------- donut gauge ---------- */
function DonutGauge({ percent }: { percent: number }) {
  const r = 42
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, percent))
  const dash = (clamped / 100) * c
  const color = clamped >= 80 ? '#2fd6c7' : clamped >= 50 ? '#f0b429' : '#f43f5e'
  const label = clamped >= 80 ? 'HEALTHY' : clamped >= 50 ? 'DEGRADED' : 'CRITICAL'
  return (
    <div className="relative w-28 h-28">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} stroke="#16283a" strokeWidth="9" fill="none" />
        <circle
          cx="50"
          cy="50"
          r={r}
          stroke={color}
          strokeWidth="9"
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-100 font-mono-data">{Math.round(clamped)}%</span>
        <span className="text-[9px] tracking-widest font-mono-data" style={{ color }}>{label}</span>
      </div>
    </div>
  )
}

/* ---------- area chart ---------- */
function AreaChart({ data }: { data: { label: string; value: number }[] }) {
  const w = 300
  const h = 80
  const max = Math.max(1, ...data.map((d) => d.value))
  const pts = data.map((d, i) => [
    (i / Math.max(1, data.length - 1)) * w,
    h - 8 - (d.value / max) * (h - 16),
  ] as const)
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${w},${h} L0,${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#21ead8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#21ead8" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#areaFill)" />
      <path d={line} stroke="#21ead8" strokeWidth="2" fill="none" />
    </svg>
  )
}

function GridStat({
  icon,
  label,
  value,
  hint,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  hint?: string
  color?: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-[#0d1826]/70 border border-[#16283a] p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-bold text-slate-100 font-mono-data">{value}</span>
        {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
      </div>
    </div>
  )
}

function OverviewPage() {
  const { overview, queues, scheduled, activity } = Route.useLoaderData()
  const [search, setSearch] = useState('')

  const totalJobs = overview.totalCompleted + overview.totalFailed
  const successRate = totalJobs > 0 ? (overview.totalCompleted / totalJobs) * 100 : 100
  const cronQueues = new Set(scheduled.map((s) => s.queue))

  const filtered = queues.filter((q) => q.name.toLowerCase().includes(search.toLowerCase()))
  const cronList = filtered.filter((q) => cronQueues.has(q.name))
  const taskList = filtered.filter((q) => !cronQueues.has(q.name))

  return (
    <div className="relative -m-6 h-screen w-full overflow-hidden">
      <MapScene queues={queues} />

      {/* overlay layer */}
      <div className="pointer-events-none absolute inset-0">
        {/* ============ TOP-LEFT: System Health ============ */}
        <GlassCard className="absolute left-4 top-4 w-[340px]">
          <CardHeader
            title="Task Health Index (THI)"
            icon={<Gauge size={16} className="text-teal-400" />}
            right={<span className="text-[10px] text-slate-500 font-mono-data">LIVE</span>}
          />
          <div className="flex items-center gap-4 px-4 py-3">
            <DonutGauge percent={successRate} />
            <div className="grid grid-cols-3 gap-2 flex-1 text-center">
              <div>
                <div className="mx-auto h-1.5 w-1.5 rounded-full bg-emerald-400 mb-1" />
                <p className="text-sm font-semibold text-slate-200 font-mono-data">{overview.totalCompleted}</p>
                <p className="text-[9px] text-slate-500 uppercase tracking-wide">Completed</p>
              </div>
              <div>
                <div className="mx-auto h-1.5 w-1.5 rounded-full bg-amber-400 mb-1" />
                <p className="text-sm font-semibold text-slate-200 font-mono-data">{overview.totalWaiting}</p>
                <p className="text-[9px] text-slate-500 uppercase tracking-wide">Waiting</p>
              </div>
              <div>
                <div className="mx-auto h-1.5 w-1.5 rounded-full bg-red-400 mb-1" />
                <p className="text-sm font-semibold text-slate-200 font-mono-data">{overview.totalFailed}</p>
                <p className="text-[9px] text-slate-500 uppercase tracking-wide">Failed</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 px-4 pb-4 pt-1 border-t border-[#16283a]">
            <div>
              <p className="flex items-center gap-1 text-[9px] text-slate-500 uppercase tracking-wide"><Activity size={10} className="text-teal-400" /> Queues</p>
              <p className="text-sm font-semibold text-slate-100 font-mono-data mt-0.5">{overview.queueCount}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-[9px] text-slate-500 uppercase tracking-wide"><Wind size={10} className="text-teal-400" /> Workers</p>
              <p className="text-sm font-semibold text-slate-100 font-mono-data mt-0.5">{overview.workerCount}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-[9px] text-slate-500 uppercase tracking-wide"><Server size={10} className="text-teal-400" /> Cron</p>
              <p className="text-sm font-semibold text-slate-100 font-mono-data mt-0.5">{scheduled.length}</p>
            </div>
          </div>
        </GlassCard>

        {/* ============ TOP-RIGHT: General grid ============ */}
        <GlassCard className="absolute right-4 top-4 w-[380px]">
          <CardHeader title="General" icon={<LayoutGrid size={16} className="text-teal-400" />} />
          <div className="grid grid-cols-2 gap-2 p-4 pt-2">
            <GridStat
              icon={<LayoutGrid size={12} />}
              color="#2fd6c7"
              label="Total tasks"
              value={totalJobs > 0 ? totalJobs : activity.days.reduce((s, d) => s + d.completed + d.failed, 0)}
              hint="jobs"
            />
            <GridStat icon={<CheckCircle2 size={12} />} color="#34d399" label="Success rate" value={`${Math.round(successRate)}%`} />
            <GridStat icon={<Zap size={12} />} color="#34d399" label="Active" value={overview.totalActive} hint="processing" />
            <GridStat icon={<Clock size={12} />} color="#f0b429" label="Waiting" value={overview.totalWaiting} hint="queued" />
            <GridStat icon={<AlertTriangle size={12} />} color="#f43f5e" label="Failed" value={overview.totalFailed} hint="errors" />
            <GridStat icon={<Users size={12} />} color="#60a5fa" label="Workers" value={overview.workerCount} hint="registered" />
          </div>
        </GlassCard>

        {/* ============ BOTTOM-LEFT: Activity forecast ============ */}
        <GlassCard className="absolute left-4 bottom-4 w-[400px]">
          <CardHeader
            title="Activity Forecast"
            icon={<Activity size={16} className="text-teal-400" />}
            right={<span className="text-[10px] text-slate-500 font-mono-data">7 DAYS</span>}
          />
          <div className="grid grid-cols-7 gap-1 px-4 pb-3 border-b border-[#16283a]">
            {activity.days.map((d) => (
              <div key={d.label} className="text-center">
                <p className="text-[9px] text-slate-500 uppercase">{d.label}</p>
                <p className={`text-xs font-mono-data mt-1 ${d.failed > 0 ? 'text-red-400' : 'text-teal-400'}`}>
                  {d.failed > 0 ? `✕${d.failed}` : `✓${d.completed}`}
                </p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-[#16283a] text-center">
            <div>
              <p className="text-[9px] text-slate-500 uppercase">Active</p>
              <p className="text-sm font-semibold text-slate-100 font-mono-data">{overview.totalActive}</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-500 uppercase">Failed</p>
              <p className="text-sm font-semibold text-red-400 font-mono-data">{overview.totalFailed}</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-500 uppercase">Waiting</p>
              <p className="text-sm font-semibold text-amber-400 font-mono-data">{overview.totalWaiting}</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-500 uppercase">Cron</p>
              <p className="text-sm font-semibold text-slate-100 font-mono-data">{scheduled.length}</p>
            </div>
          </div>
          <div className="px-4 pb-4 pt-2">
            <p className="text-[9px] uppercase tracking-wider text-slate-500 pb-1">Completed / day</p>
            <AreaChart data={activity.days.map((d) => ({ label: d.label, value: d.completed }))} />
          </div>
        </GlassCard>

        {/* ============ BOTTOM-RIGHT: Queue configuration ============ */}
        <GlassCard className="absolute right-4 bottom-4 w-[320px]">
          <CardHeader title="Queue Configuration" icon={<Building2 size={16} className="text-teal-400" />} />
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 rounded-lg bg-[#0d1826] border border-[#16283a] px-2.5 py-2">
              <Search size={13} className="text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search queues"
                className="w-full bg-transparent text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto px-4 pb-4 space-y-3">
            {[{ title: 'Cron Queues', list: cronList }, { title: 'Task Queues', list: taskList }].map(
              (cat) =>
                cat.list.length > 0 && (
                  <div key={cat.title}>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 py-2">{cat.title}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {cat.list.map((q) => (
                        <Link
                          key={q.name}
                          to="/queues/$queueName"
                          params={{ queueName: q.name }}
                          className="group flex flex-col items-center gap-1.5 rounded-lg border border-[#16283a] bg-[#0d1826] p-3 hover:border-teal-500/50 hover:bg-[#10202f] transition-colors"
                        >
                          <Building2
                            size={20}
                            className={q.failed > 0 ? 'text-red-400' : 'text-teal-400/80'}
                          />
                          <span className="text-[10px] font-mono-data text-slate-300 group-hover:text-teal-300 text-center leading-tight break-all">
                            {q.name}
                          </span>
                          {q.failed > 0 && (
                            <span className="text-[9px] font-mono-data text-red-400 animate-pulse">
                              ● {q.failed} ERR
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                )
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
