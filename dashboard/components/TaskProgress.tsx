import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { TaskProgress } from '@cleo/core/src/types/interfaces';
interface TaskProgressProps {
  taskId?: string;  // If provided, show only this task
  showAll?: boolean;  // If true, show all tasks
}

export const TaskProgressComponent: React.FC<TaskProgressProps> = ({ taskId, showAll = false }) => {
  const [progressData, setProgressData] = useState<Map<string, TaskProgress>>(new Map());
  const ws = useWebSocket('ws://localhost:3001');

  useEffect(() => {
    if (!ws) return;

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'init') {
        const initialData = new Map(message.data as [string, TaskProgress][]);
        setProgressData(initialData);
      } else if (message.type === 'progress') {
        setProgressData(prev => new Map(prev).set(message.data.taskId, message.data));
      } else if (message.type === 'clear') {
        setProgressData(prev => {
          const newData = new Map(prev);
          newData.delete(message.data.taskId);
          return newData;
        });
      }
    };
  }, [ws]);

  const getDisplayData = () => {
    if (taskId) {
      return progressData.has(taskId) ? [progressData.get(taskId)!] : [];
    }
    return Array.from(progressData.values());
  };

  const formatBytes = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  };

  const calculateTimeRemaining = (task: TaskProgress) => {
    const now = new Date();
    const remaining = task.metrics.estimatedCompletion.getTime() - now.getTime();
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="space-y-4">
      {getDisplayData().map(task => (
        <div key={task.taskId} className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">Task: {task.taskId}</h3>
            <span className="text-sm text-gray-500">
              {task.progress}% Complete
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${task.progress}%` }}
            />
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">CPU Usage:</span>
              <span className="ml-2">{task.metrics.cpuUsage.toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-gray-500">Memory:</span>
              <span className="ml-2">{formatBytes(task.metrics.memoryUsage)}</span>
            </div>
            <div>
              <span className="text-gray-500">Started:</span>
              <span className="ml-2">
                {task.metrics.startTime.toLocaleTimeString()}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Time Remaining:</span>
              <span className="ml-2">{calculateTimeRemaining(task)}</span>
            </div>
          </div>
        </div>
      ))}

      {getDisplayData().length === 0 && (
        <div className="text-center text-gray-500 py-8">
          No tasks in progress
        </div>
      )}
    </div>
  );
}; 