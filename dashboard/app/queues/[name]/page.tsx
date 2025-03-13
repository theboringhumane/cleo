'use client';

import * as React from "react";
import { useQueue, useQueueMetricsForQueue } from "../../../hooks/useApi";
import { DataTable } from "../../../components/ui/data-table";
import { MetricsChart } from "../../../components/ui/metrics-chart";
import { ColumnDef } from "@tanstack/react-table";
import { Task } from "../../../types/api";
import { Button } from "../../../components/ui/button";
import { Trash2, Loader2, ArrowLeft } from "lucide-react";
import { deleteTask } from "../../../lib/api";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

const columns: ColumnDef<Task>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => {
      const task = row.original;
      return (
        <Link
          href={`/queues/task/${task.id}`}
          className="text-primary hover:underline"
        >
          {task.id}
        </Link>
      );
    },
  },
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "state",
    header: "State",
  },
  {
    accessorKey: "group",
    header: "Group",
  },
  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) => {
      const date = new Date(row.getValue("createdAt"));
      return date.toLocaleString();
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const task = row.original;
      const [isDeleting, setIsDeleting] = useState(false);

      return (
        <Button
          variant="ghost"
          size="icon"
          disabled={isDeleting}
          onClick={async () => {
            try {
              setIsDeleting(true);
              await deleteTask(task.id);
              toast.success("Task deleted", {
                description: `Task ${task.id} has been deleted.`,
              });
            } catch (error) {
              toast.error("Error", {
                description: "Failed to delete task.",
              });
            } finally {
              setIsDeleting(false);
            }
          }}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      );
    },
  },
];

export default function QueuePage() {
  const { name } = useParams();
  const router = useRouter();
  const { data: queueData, error, isLoading } = useQueue(name as string);
  const { data: metricsData } = useQueueMetricsForQueue(name as string);

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <div className="bg-destructive/15 text-destructive px-4 py-2 rounded-md">
          Error loading queue data: {error.message}
        </div>
      </div>
    );
  }

  if (isLoading || !queueData || !metricsData) {
    return (
      <div className="container mx-auto py-10 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const latestMetrics = metricsData.metrics[metricsData.metrics.length - 1];

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8 flex items-center gap-4">
        <Link href="/queues">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Queue: {name}</h1>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-card rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Active Tasks</div>
          <div className="text-2xl font-bold">{latestMetrics.active}</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Waiting Tasks</div>
          <div className="text-2xl font-bold">{latestMetrics.waiting}</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Completed Tasks</div>
          <div className="text-2xl font-bold">{latestMetrics.completed}</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Failed Tasks</div>
          <div className="text-2xl font-bold">{latestMetrics.failed}</div>
        </div>
      </div>

      <div className="mb-8">
        <MetricsChart
          title="Queue Metrics"
          data={metricsData.metrics}
          metrics={["waiting", "active", "completed", "failed"]}
        />
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Tasks</h2>
        <DataTable
          columns={columns}
          data={queueData.tasks}
          pageSize={10}
        />
      </div>
    </div>
  );
} 