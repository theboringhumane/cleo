import { NextResponse } from 'next/server';
import { QueueService } from '@/lib/services/queue.service';

interface RouteParams {
  params: {
    taskId: string;
  };
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const success = await QueueService.removeTask(params.taskId);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing task:', error);
    return NextResponse.json(
      { error: 'Failed to remove task' },
      { status: 500 }
    );
  }
} 