"use client"

import React from 'react';
import { useTasks } from "@/hooks/useTasks"
import { Button } from "@/components/ui/button"
import { Icons } from "@/components/icons"
import { Task } from '@/types/api';
// Extend the Task type to include metadata
interface TaskWithMetadata extends Task {
  id: string;
  name: string;
  data: any;
  metadata?: {
    description?: string;
    progress?: number;
    startTime?: string;
    endTime?: string;
    attempts?: number;
    error?: string;
    logs?: string[];
  };
}

export function TaskList() {
  const { tasks, isLoading } = useTasks()
  const typedTasks = tasks as TaskWithMetadata[] | undefined;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 border border-gray-800 rounded-lg animate-pulse">
            <div className="space-y-3">
              <div className="h-4 w-1/3 bg-gray-800 rounded" />
              <div className="h-4 w-1/4 bg-gray-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {typedTasks?.map((task) => (
        <div
          key={task.id}
          className="p-4 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-white">{task.name}</h3>
              <p className="text-xs text-gray-400">
                {task.metadata?.description || task.data?.description || 'No description'}
              </p>
              {task.metadata?.startTime && (
                <p className="text-xs text-gray-500">
                  Started: {new Date(task.metadata.startTime).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <StatusBadge status={task.state} />
              {task.metadata?.attempts && task.metadata.attempts > 0 && (
                <span className="text-xs text-yellow-500">
                  Retries: {task.metadata.attempts}
                </span>
              )}
              <Button variant="ghost" size="sm" className="h-8 w-8">
                <Icons.ellipsis className="h-4 w-4" />
                <span className="sr-only">Task actions</span>
              </Button>
            </div>
          </div>
          {task.metadata?.progress !== undefined && (
            <div className="mt-4">
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-in-out"
                  style={{ width: `${task.metadata.progress}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between items-center text-xs text-gray-400">
                <span>{task.metadata.progress}%</span>
                {task.metadata.attempts && (
                  <span>Attempts: {task.metadata.attempts}</span>
                )}
              </div>
            </div>
          )}
          {task.metadata?.error && (
            <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
              {task.metadata.error}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "SUCCESS":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      case "FAILURE":
        return "bg-red-500/10 text-red-500 border-red-500/20"
      case "RUNNING":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      case "RETRY":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
    }
  }

  return (
    <span
      className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${getStatusColor(
        status
      )}`}
    >
      {status}
    </span>
  )
}