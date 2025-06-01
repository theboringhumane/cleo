import { NextResponse } from 'next/server';
import { QueueService } from '@/lib/services/queue.service';

interface RouteParams {
  params: {
    queueName: string;
  };
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    const metrics = await QueueService.getQueueMetricsHistory(
      params.queueName,
      start ? parseInt(start) : undefined,
      end ? parseInt(end) : undefined
    );

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching queue metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch queue metrics' },
      { status: 500 }
    );
  }
} 