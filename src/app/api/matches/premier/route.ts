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
      queue_id: { equals: "Premier", mode: "insensitive" }
    };

    if (seasonParam && seasonParam !== 'all' && seasonParam !== "") {
      whereClause.premier_season_id = seasonParam;
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

    const seasons = await db.season.findMany({
      where: { matches: { some: { teamId } } },
      orderBy: { starts_at: 'desc' }
    });
    
    const activeSeason = seasons.find(s => {
      const now = new Date();
      return new Date(s.starts_at) <= now && new Date(s.ends_at) >= now;
    });

    return NextResponse.json({
      matches: formattedMatches,
      seasons: seasons.map(s => ({ id: s.id, name: s.name })),
      activeSeasonId: activeSeason?.id || (seasons.length > 0 ? seasons[0].id : null)
    });

  } catch (error: any) {
    console.error("API /matches/premier error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
