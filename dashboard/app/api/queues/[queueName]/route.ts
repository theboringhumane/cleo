import { NextResponse } from 'next/server';
import { QueueService } from '@/lib/services/queue.service';

interface RouteParams {
  params: {
    queueName: string;
  };
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const queue = await QueueService.getQueueByName(params.queueName);
    return NextResponse.json(queue);
  } catch (error) {
    console.error('Error fetching queue:', error);
    return NextResponse.json(
      { error: 'Failed to fetch queue' },
      { status: 500 }
    );
  }
} 