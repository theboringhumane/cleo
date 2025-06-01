'use client';

import { useState } from "react";
import { useGroups, useGroupTasks, useGroupStats } from "../../hooks/useApi";
import { DataTable } from "../../components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ColumnDef } from "@tanstack/react-table";
import { Task } from "../../types/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

const columns: ColumnDef<Task>[] = [
  {
    accessorKey: "id",
    header: "ID",
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
    accessorKey: "options.queue",
    header: "Queue",
  },
  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) => {
      const date = new Date(row.getValue("createdAt"));
      return date.toLocaleString();
    },
  },
];

export default function GroupsPage() {
  const { data: groupsData, error: groupsError, isLoading: groupsLoading } = useGroups();
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const { data: tasksData, error: tasksError, isLoading: tasksLoading } = useGroupTasks(selectedGroup);
  const { data: statsData, error: statsError, isLoading: statsLoading } = useGroupStats(selectedGroup);

  if (groupsLoading || tasksLoading || statsLoading) {
    return <div>Loading...</div>;
  }

  if (!groupsData || !tasksData || !statsData) {
    return <div>No data</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-4xl font-bold mb-8">Groups Dashboard</h1>

      <div className="mb-8">
        <Select
          value={selectedGroup}
          onValueChange={setSelectedGroup}
        >
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Select a group" />
          </SelectTrigger>
          <SelectContent>
            {groupsData.groups.map((group) => (
              <SelectItem key={group.name} value={group.name}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedGroup && (
        <>
          {statsData && !statsError && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle>Total Tasks</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{statsData.stats.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Active</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{statsData.stats.active}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Completed</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{statsData.stats.completed}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Failed</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{statsData.stats.failed}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Paused</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{statsData.stats.paused}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {tasksData && !tasksError && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Tasks in {selectedGroup}</h2>
              <DataTable
                columns={columns}
                data={tasksData.tasks}
                pageSize={10}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
} 