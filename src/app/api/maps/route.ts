/* eslint-disable no-undef */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { valorantApi } from '@/lib/valorant-api';
import { getPremierSeasons } from '@/lib/henrik-api';

let lastSync = 0;
const SYNC_COOLDOWN = 12 * 60 * 60 * 1000; // 12 horas

export async function GET() {
  try {
    let dbMaps = await prisma.map.findMany({
      orderBy: { name: 'asc' },
    });

    const nowTime = Date.now();
    const shouldSync = dbMaps.length === 0 || (nowTime - lastSync > SYNC_COOLDOWN);

    if (shouldSync) {
      console.log('🔄 Syncing maps from Valorant API...');
      const mapsData = await valorantApi.mapsEndpoints.getMapsV1();

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
      dbMaps = await prisma.map.findMany({ orderBy: { name: 'asc' } });
      lastSync = nowTime;
      console.log('✅ Maps sync completed.');
    }

    // Identificar qué mapas están en rotación activa según la temporada Premier actual
    const activeMapIds = new Set<string>();
    try {
      const seasons = await getPremierSeasons('eu');
      const now = new Date();
      let activeSeason = seasons.find(s => {
        const start = s.starts_at ? new Date(s.starts_at) : null;
        const end = s.ends_at ? new Date(s.ends_at) : null;
        return start && end && now >= start && now <= end;
      });

      if (!activeSeason && seasons.length > 0) {
        // Fallback: ordenar por fecha de fin desc para traer la más reciente
        activeSeason = [...seasons].sort((a, b) => {
          const endB = b.ends_at ? new Date(b.ends_at).getTime() : 0;
          const endA = a.ends_at ? new Date(a.ends_at).getTime() : 0;
          return endB - endA;
        })[0];
      }

      if (activeSeason?.events) {
        for (const event of activeSeason.events) {
          if (event.map_selection?.maps) {
            for (const m of event.map_selection.maps) {
              if (m.id) {
                activeMapIds.add(m.id.toLowerCase());
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching premier seasons for map rotation:', err);
    }

    const enrichedMaps = dbMaps.map(m => {
      const activeInRotation = activeMapIds.has(m.id.toLowerCase());
      return {
        ...m,
        activeInRotation
      };
    });

    return NextResponse.json({ maps: enrichedMaps });
  } catch (error) {
    console.error('Error fetching maps:', error);
    return NextResponse.json({ error: 'Failed to fetch maps' }, { status: 500 });
  }
}
