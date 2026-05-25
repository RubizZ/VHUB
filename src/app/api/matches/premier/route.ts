import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const teamId = session?.user?.teamId as string | undefined;
    if (!teamId) return NextResponse.json({ error: "No team context" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const seasonParam = searchParams.get("season");

    const whereClause: Prisma.MatchWhereInput = {
      teamId,
      OR: [
        { queue_id: { equals: "Premier", mode: "insensitive" } },
        { events: { some: { type: { in: ["match", "playoffs"] } } } },
        { premier_season_id: { not: null } }
      ]
    };

    const seasons = await db.season.findMany({
      where: { matches: { some: { teamId } } },
      orderBy: { starts_at: 'desc' }
    });
    
    let activeSeasonId = null;
    const nowTime = new Date();
    const activeSeason = seasons.find(s => {
      if (!s.starts_at || !s.ends_at) return false;
      return new Date(s.starts_at) <= nowTime && new Date(s.ends_at) >= nowTime;
    });
    
    if (activeSeason) {
      activeSeasonId = activeSeason.id;
    } else if (seasons.length > 0) {
      activeSeasonId = seasons[0].id;
    }

    if (seasonParam === 'all') {
      // Do not filter by season
    } else if (seasonParam && seasonParam !== "") {
      whereClause.premier_season_id = seasonParam;
    } else if (activeSeasonId) {
      // Default to active season if no parameter is provided
      whereClause.premier_season_id = activeSeasonId;
    }

    const matches = await db.match.findMany({
      where: whereClause,
      include: {
        player_stats: {
          select: { 
            team_id: true,
            puuid: true
          }
        },
        season: true,
        events: true // to know which event it belongs to
      },
      orderBy: { game_start: 'desc' },
      take: 100
    });

    const teamPlayers = await db.player.findMany({
      where: { teamId },
      include: { user: { select: { dataConsent: true } } }
    });

    const playerMap = new Map(teamPlayers.map(p => [p.puuid, p]));

    const formattedMatches = matches.map(match => {
      const hasConsent = match.player_stats.some(s => {
        const p = playerMap.get(s.puuid);
        return p?.user?.dataConsent === true;
      });

      if (!hasConsent) {
        return {
          id: match.id,
          riot_match_id: match.riot_match_id,
          game_start: match.game_start,
          isHidden: true,
          reason: "Este partido está oculto por falta de consentimiento de datos."
        };
      }

      const ourSide = match.player_stats.find(s => {
        const p = playerMap.get(s.puuid);
        return p?.teamId === teamId;
      })?.team_id || "Blue";

      let eventData = null;
      if (match.events && match.events.length > 0) {
        const e = match.events[0];
        eventData = {
          id: e.id,
          title: e.title,
          type: e.type,
          date: e.date,
          time: e.time
        };
      }

      return {
        ...match,
        our_team_side: ourSide,
        event: eventData
      };
    });

    return NextResponse.json({
      matches: formattedMatches,
      seasons: seasons.map(s => ({ id: s.id, name: s.name })),
      activeSeasonId: activeSeasonId
    });

  } catch (error: any) {
    console.error("API /matches/premier error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
