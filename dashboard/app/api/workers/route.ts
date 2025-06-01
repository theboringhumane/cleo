import { NextResponse } from 'next/server';
import { WorkerService } from '@/lib/services/worker.service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const queueFilter = searchParams.get('queue');
    
    const workers = await WorkerService.getAllWorkers(queueFilter || undefined);
    return NextResponse.json(workers);
  } catch (error) {
    console.error('Error fetching workers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workers' },
      { status: 500 }
    );
  }
} 