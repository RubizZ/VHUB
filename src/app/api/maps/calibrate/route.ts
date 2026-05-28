import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { mapId, pixelsPerMeter } = body;

    if (!mapId || typeof pixelsPerMeter !== 'number') {
      return NextResponse.json({ error: 'Missing or invalid parameters' }, { status: 400 });
    }

    const updatedMap = await prisma.map.update({
      where: { id: mapId },
      data: { pixelsPerMeter },
    });

    return NextResponse.json({ map: updatedMap });
  } catch (error) {
    console.error('Error calibrating map:', error);
    return NextResponse.json({ error: 'Failed to calibrate map' }, { status: 500 });
  }
}
