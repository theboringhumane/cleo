'use client';

import { Card } from '@/components/ui/card';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import React from 'react';

export default function Metrics() {
  return (
    <DashboardLayout>
      <div className="p-4 md:p-10 mx-auto max-w-7xl">
        <h1 className="text-2xl font-bold">Metrics</h1>
        <p className="text-gray-500">View detailed performance metrics and analytics</p>

        <div className="mt-6">
          <Card>
            <h2 className="text-lg font-bold">Coming Soon</h2>
            <p className="text-gray-500">Detailed metrics and analytics will be available soon.</p>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
} 