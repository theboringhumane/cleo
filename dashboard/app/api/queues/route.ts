import { NextResponse } from 'next/server';
import { QueueService } from '@/lib/services/queue.service';

export async function GET() {
  try {
    const queues = await QueueService.getAllQueues();
    return NextResponse.json(queues);
  } catch (error) {
    console.error('Error fetching queues:', error);
    return NextResponse.json(
      { error: 'Failed to fetch queues' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { name, data, options } = await request.json();
    const task = await QueueService.addTask(name, data, options);
    return NextResponse.json(task);
  } catch (error) {
    console.error('Error adding task:', error);
    return NextResponse.json(
      { error: 'Failed to add task' },
      { status: 500 }
    );
  }
} 