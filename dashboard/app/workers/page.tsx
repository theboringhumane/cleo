"use client";

import { useWorkers } from "@/hooks/useApi";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Pause } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Worker } from "@/types/api";
import { pauseWorker, resumeWorker } from "@/lib/api";
import { toast } from "sonner";
import { useState } from "react";
import Link from "next/link";

const columns: ColumnDef<Worker>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => {
      const worker = row.original;
      return (
        <Link
          href={`/workers/${worker.id}`}
          className="text-primary hover:underline"
        >
          {worker.id}
        </Link>
      );
    },
  },
  {
    accessorKey: "queue",
    header: "Queue",
    cell: ({ row }) => {
      const worker = row.original;
      return (
        <Link
          href={`/queues/${worker.queue}`}
          className="text-primary hover:underline"
        >
          {worker.queue}
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
            status === "active"
              ? "bg-green-100 text-green-800"
              : status === "paused"
              ? "bg-yellow-100 text-yellow-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {status}
        </span>
      );
    },
  },
  {
    accessorKey: "metrics.tasksProcessed",
    header: "Tasks Processed",
  },
  {
    accessorKey: "metrics.averageProcessingTime",
    header: "Avg. Processing Time (ms)",
    cell: ({ row }) => {
      const time = row.getValue("metrics.averageProcessingTime") as number;
      return Math.round(time);
    },
  },
  {
    accessorKey: "lastHeartbeat",
    header: "Last Heartbeat",
    cell: ({ row }) => {
      const date = new Date(row.getValue("lastHeartbeat"));
      return date.toLocaleString();
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const worker = row.original;
      const [isLoading, setIsLoading] = useState(false);

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

      return (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggle}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : worker.status === "paused" ? (
            <Play className="h-4 w-4" />
          ) : (
            <Pause className="h-4 w-4" />
          )}
        </Button>
      );
    },
  },
];

export default function WorkersPage() {
  const { data: workersData, error, isLoading } = useWorkers();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <div className="bg-destructive/15 text-destructive px-4 py-2 rounded-md">
          Error loading workers: {error.message}
        </div>
      </div>
    );
  }

  if (!workersData) {
    return <div>No data</div>;
  }

  const activeWorkers = workersData.workers.filter(
    (worker) => worker.status === "active"
  ).length;

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-4xl font-bold mb-8">Workers Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Active Workers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeWorkers} / {workersData.workers.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Workers</h2>
        <DataTable columns={columns} data={workersData.workers} pageSize={10} />
      </div>
    </div>
  );
}
