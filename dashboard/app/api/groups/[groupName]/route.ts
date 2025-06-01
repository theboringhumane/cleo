import { NextResponse } from 'next/server';
import { GroupService } from '@/lib/services/group.service';

interface RouteParams {
  params: {
    groupName: string;
  };
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const group = await GroupService.getGroupByName(params.groupName);
    return NextResponse.json(group);
  } catch (error) {
    console.error('Error fetching group:', error);
    return NextResponse.json(
      { error: 'Failed to fetch group' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { priority } = await request.json();
    const updatedGroup = await GroupService.updateGroupPriority(params.groupName, priority);
    return NextResponse.json(updatedGroup);
  } catch (error) {
    console.error('Error updating group priority:', error);
    return NextResponse.json(
      { error: 'Failed to update group priority' },
      { status: 500 }
    );
  }
} 