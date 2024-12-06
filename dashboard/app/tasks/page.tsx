'use client';

import { Card } from '@/components/ui/card';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { TaskList } from '../../components/TaskList';
import React from 'react';

export default function Tasks() {
  return (
    <DashboardLayout>
      <div className="p-4 md:p-10 mx-auto max-w-7xl">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <p className="text-gray-500">View and manage all tasks in the queue</p>

        <div className="mt-6">
          <Card>
            <TaskList />
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
} 