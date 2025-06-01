import { NextResponse } from 'next/server';
import { GroupService } from '@/lib/services/group.service';

interface RouteParams {
  params: {
    groupName: string;
  };
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const stats = await GroupService.getGroupStats(params.groupName);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching group stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch group stats' },
      { status: 500 }
    );
  }
} 