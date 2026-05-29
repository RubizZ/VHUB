import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const agents = await prisma.agent.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        displayIcon: true,
        role: true,
        roleIcon: true,
      }
    });

    return NextResponse.json({ agents });
  } catch (error) {
    console.error('Error fetching light agents:', error);
    return NextResponse.json({ error: 'Failed to fetch light agents' }, { status: 500 });
  }
}
