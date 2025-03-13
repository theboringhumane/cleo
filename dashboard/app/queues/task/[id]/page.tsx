'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useTask } from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

export default function TaskPage() {
  const { id } = useParams();
  const { data: taskData, error, isLoading } = useTask(id as string);

  if (error) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-destructive">Failed to load task data</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const { task, history } = taskData!;

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex items-center gap-4">
        <Link href={`/queues/${task.queue}`}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Task Details</h1>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Task Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4">
              <div>
                <dt className="font-medium text-muted-foreground">ID</dt>
                <dd className="mt-1">{task.id}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Name</dt>
                <dd className="mt-1">{task.name}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Queue</dt>
                <dd className="mt-1">{task.queue}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Group</dt>
                <dd className="mt-1">{task.group || 'None'}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">State</dt>
                <dd className="mt-1">
                  <Badge
                    variant={
                      task.state === 'completed'
                        ? 'success'
                        : task.state === 'failed'
                        ? 'destructive'
                        : task.state === 'active'
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {task.state}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Created At</dt>
                <dd className="mt-1">
                  {formatDistanceToNow(new Date(task.createdAt), {
                    addSuffix: true,
                  })}
                </dd>
              </div>
              {task.data && (
                <div>
                  <dt className="font-medium text-muted-foreground">Data</dt>
                  <dd className="mt-1">
                    <pre className="rounded-lg bg-muted p-4">
                      <code>{JSON.stringify(task.data, null, 2)}</code>
                    </pre>
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Task History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] overflow-auto pr-4">
              <div className="space-y-8">
                {history.map((event, index) => (
                  <div
                    key={index}
                    className="relative pl-8 before:absolute before:left-3 before:top-2 before:h-2 before:w-2 before:rounded-full before:bg-primary"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{event.state}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(event.timestamp), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    {event.data && (
                      <pre className="mt-2 rounded-lg bg-muted p-4">
                        <code>{JSON.stringify(event.data, null, 2)}</code>
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 