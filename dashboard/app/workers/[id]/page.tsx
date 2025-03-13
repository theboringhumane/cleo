'use client';

import { useWorker, useWorkerMetrics } from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { MetricsChart } from "@/components/ui/metrics-chart";
import { ColumnDef } from "@tanstack/react-table";
import { TaskHistoryEntry } from "@/types/api";
import { Loader2, ArrowLeft, Play, Pause } from "lucide-react";
import { pauseWorker, resumeWorker } from "@/lib/api";
import { toast } from "sonner";
import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

const columns: ColumnDef<TaskHistoryEntry>[] = [
  {
    accessorKey: "taskId",
    header: "Task ID",
    cell: ({ row }) => {
      const taskId = row.getValue("taskId") as string;
      return (
        <Link
          href={`/queues/task/${taskId}`}
          className="text-primary hover:underline"
        >
          {taskId}
        </Link>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            status === "completed"
              ? "bg-green-100 text-green-800"
              : status === "failed"
              ? "bg-red-100 text-red-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {status}
        </span>
      );
    },
  },
  {
    accessorKey: "duration",
    header: "Duration (ms)",
  },
  {
    accessorKey: "timestamp",
    header: "Timestamp",
    cell: ({ row }) => {
      const date = new Date(row.getValue("timestamp"));
      return date.toLocaleString();
    },
  },
];

export default function WorkerPage() {
  const { id } = useParams();
  const { data: workerData, error: workerError } = useWorker(id as string);
  const { data: metricsData, error: metricsError } = useWorkerMetrics(id as string);
  const [isLoading, setIsLoading] = useState(false);

  if (workerError || metricsError) {
    return (
      <div className="container mx-auto py-10">
        <div className="bg-destructive/15 text-destructive px-4 py-2 rounded-md">
          Error loading worker data: {workerError?.message || metricsError?.message}
        </div>
      </div>
    );
  }

  if (!workerData || !metricsData) {
    return (
      <div className="container mx-auto py-10 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const worker = workerData;

  const handleToggle = async () => {
    try {
      setIsLoading(true);
      if (worker.status === "paused") {
        await resumeWorker(worker.id);
        toast.success("Worker resumed");
      } else {
        await pauseWorker(worker.id);
        toast.success("Worker paused");
      }
    } catch (error) {
      toast.error("Failed to update worker status");
    } finally {
      setIsLoading(false);
    }
  };

  if (worker === undefined) {
    return (
      <div className="container mx-auto py-10">
        <div className="bg-destructive/15 text-destructive px-4 py-2 rounded-md">
          Worker not found
        </div>
      </div>
    );
  }
  return (
    <div className="container mx-auto py-10">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/workers">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Worker: {worker.id}</h1>
        </div>
        <Button
          variant="outline"
          onClick={handleToggle}
          disabled={isLoading}
          className="w-32"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : worker.status === "paused" ? (
            <>
              <Play className="h-4 w-4 mr-2" />
              Resume
            </>
          ) : (
            <>
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                worker.status === "active"
                  ? "bg-green-100 text-green-800"
                  : worker.status === "paused"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {worker.status}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tasks Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {worker.metrics.tasksProcessed}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {worker.metrics.tasksProcessed
                ? Math.round(
                    (worker.metrics.tasksSucceeded /
                      worker.metrics.tasksProcessed) *
                      100
                  )
                : 0}
              %
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Avg. Processing Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(worker.metrics.averageProcessingTime)} ms
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-8">
        <MetricsChart
          title="Worker Metrics History"
          data={metricsData.history}
          metrics={[
            "tasksProcessed",
            "tasksSucceeded",
            "tasksFailed",
            "averageProcessingTime",
          ]}
          colors={{
            tasksProcessed: "#2563eb",
            tasksSucceeded: "#16a34a",
            tasksFailed: "#dc2626",
            averageProcessingTime: "#ca8a04",
          }}
        />
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Task History</h2>
        <DataTable
          columns={columns}
          data={worker.history || []}
          pageSize={10}
        />
      </div>
    </div>
  );
} 