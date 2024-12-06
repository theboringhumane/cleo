"use client"

import { Card } from "@/components/ui/card"
import { useQueueMetrics } from "@/hooks/useQueueMetrics"
import { Icons } from "@/components/icons"

export function QueueStats() {
  const { metrics, isLoading } = useQueueMetrics()

  const stats = [
    {
      title: "Total Tasks",
      value: metrics?.totalTasks || 0,
      icon: <Icons.tasks className="h-4 w-4" />,
      description: "Total tasks processed",
    },
    {
      title: "Active Tasks",
      value: metrics?.activeTasks || 0,
      icon: <Icons.active className="h-4 w-4" />,
      description: "Currently running tasks",
    },
    {
      title: "Success Rate",
      value: `${((metrics?.completedTasks || 0) / (metrics?.totalTasks || 1) * 100).toFixed(1)}%`,
      icon: <Icons.chart className="h-4 w-4" />,
      description: "Task completion rate",
    },
  ]

  if (isLoading) {
    return (
      <>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6 bg-black border border-gray-800">
            <div className="space-y-3">
              <div className="h-4 w-24 bg-gray-800 rounded animate-pulse" />
              <div className="h-8 w-16 bg-gray-800 rounded animate-pulse" />
            </div>
          </Card>
        ))}
      </>
    )
  }

  return (
    <>
      {stats.map((stat) => (
        <Card
          key={stat.title}
          className="p-6 bg-black border border-gray-800 hover:border-gray-700 transition-colors"
        >
          <div className="flex items-center space-x-2 text-gray-500 mb-2">
            {stat.icon}
            <span className="text-sm font-medium">{stat.title}</span>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-sm text-gray-400">{stat.description}</p>
          </div>
        </Card>
      ))}
    </>
  )
} 