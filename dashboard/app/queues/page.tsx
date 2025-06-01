'use client';

import { useQueues, useQueueMetrics } from "../../hooks/useApi";
import { DataTable } from "../../components/ui/data-table";
import { MetricsChart } from "../../components/ui/metrics-chart";
import { ColumnDef } from "@tanstack/react-table";
import { Task } from "../../types/api";
import { Button } from "../../components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { deleteTask } from "../../lib/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
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
    accessorKey: "queue",
    header: "Queue",
    cell: ({ row }) => {
      const task = row.original;
      return (
        <Link
          href={`/queues/${task.queue}`}
          className="text-primary hover:underline"
        >
          {task.queue}
        </Link>
      );
    },
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
      return (
        <Button
          variant="ghost"
          size="icon"
          onClick={async () => {
            try {
              await deleteTask(task.id);
              toast.success("Task deleted", {
                description: `Task ${task.id} has been deleted.`,
              });
            } catch (error) {
              toast.error("Error", {
                description: "Failed to delete task.",
              });
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      );
    },
  },
];

export default function QueuesPage() {
  const { data: queuesData, error: queuesError, isLoading: queuesLoading } = useQueues();
  const { data: metricsData, error: metricsError, isLoading: metricsLoading } = useQueueMetrics();
  const router = useRouter();

  if (queuesError || metricsError) {
    console.error(queuesError, metricsError);
    return <div>Error loading data</div>;
  }

  if (queuesLoading || metricsLoading) {
    console.log("Loading data...");
    return (
      <div className="container mx-auto py-10 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!queuesData || !metricsData) {
    return <div>No data</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-4xl font-bold mb-8">Queues Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {queuesData.queues.map((queue) => (
          <Card
            key={queue.name}
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => router.push(`/queues/${queue.name}`)}
          >
            <CardHeader>
              <CardTitle>{queue.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="font-semibold">{queue.metrics.active}</div>
                    <div>Active</div>
                  </div>
                  <div>
                    <div className="font-semibold">{queue.metrics.waiting}</div>
                    <div>Waiting</div>
                  </div>
                  <div>
                    <div className="font-semibold">{queue.metrics.completed}</div>
                    <div>Completed</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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
          data={queuesData.queues.flatMap(queue => queue.tasks)}
          pageSize={10}
        />
      </div>
    </div>
  );
} 