import { NextResponse } from 'next/server';
import { WorkerService } from '@/lib/services/worker.service';

interface RouteParams {
  params: {
    workerId: string;
  };
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const worker = await WorkerService.getWorker(params.workerId);
    
    if (!worker) {
      return NextResponse.json(
        { error: 'Worker not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(worker);
  } catch (error) {
    console.error('Error fetching worker:', error);
    return NextResponse.json(
      { error: 'Failed to fetch worker' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const success = await WorkerService.removeWorker(params.workerId);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Worker not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing worker:', error);
    return NextResponse.json(
      { error: 'Failed to remove worker' },
      { status: 500 }
    );
  }
} 