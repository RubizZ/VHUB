import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    let maps = await prisma.map.findMany({
      orderBy: { name: 'asc' },
    });

    // Auto-sync si no hay mapas
    if (maps.length === 0) {
      console.log('🔄 Auto-syncing maps from Valorant API...');
      const response = await fetch('https://valorant-api.com/v1/maps');
      const json = await response.json();
      const mapsData = json.data;

      for (const map of mapsData) {
        if (map.tacticalDescription) {
          await prisma.map.upsert({
            where: { id: map.uuid },
            update: {
              name: map.displayName,
              displayIcon: map.displayIcon,
              splash: map.splash,
              listViewIcon: map.listViewIcon,
              listViewIconTall: map.listViewIconTall,
              premierBackground: map.premierBackgroundImage,
              mapUrl: map.mapUrl,
              tacticalDescription: map.tacticalDescription,
            },
            create: {
              id: map.uuid,
              name: map.displayName,
              displayIcon: map.displayIcon,
              splash: map.splash,
              listViewIcon: map.listViewIcon,
              listViewIconTall: map.listViewIconTall,
              premierBackground: map.premierBackgroundImage,
              mapUrl: map.mapUrl,
              tacticalDescription: map.tacticalDescription,
            },
          });
        }
      }
      maps = await prisma.map.findMany({ orderBy: { name: 'asc' } });
    }

    return NextResponse.json({ maps });
  } catch (error) {
    console.error('Error fetching maps:', error);
    return NextResponse.json({ error: 'Failed to fetch maps' }, { status: 500 });
  }
}
