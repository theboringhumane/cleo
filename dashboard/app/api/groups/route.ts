import { NextResponse } from 'next/server';
import { GroupService } from '@/lib/services/group.service';

export async function GET() {
  try {
    const groups = await GroupService.getAllGroups();
    return NextResponse.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch groups' },
      { status: 500 }
    );
  }
} 