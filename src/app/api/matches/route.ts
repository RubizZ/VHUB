import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRiotClient } from "@/lib/riot/client";
import { findMapByUrl } from "@/lib/maps";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("id");

  if (matchId) {
    const match = await db.match.findFirst({
      where: {
        OR: [
          { id: isNaN(Number(matchId)) ? -1 : Number(matchId) },
          { riot_match_id: matchId }
        ]
      },
      include: {
        player_stats: {
          include: {
            player: { select: { name: true, avatar_color: true } }
          },
          orderBy: { score: 'desc' }
        }
      }
    });

    if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

    // Transform player stats to match previous API format
    const playerStats = match.player_stats.map(s => ({
      ...s,
      player_name: s.player?.name,
      avatar_color: s.player?.avatar_color
    }));

    return NextResponse.json({ match, playerStats });
  }

  const matches = await db.match.findMany({
    select: {
      id: true,
      riot_match_id: true,
      map_name: true,
      game_mode: true,
      game_start: true,
      game_length_ms: true,
      queue_id: true,
      team_blue_score: true,
      team_red_score: true,
      team_blue_won: true,
      event_id: true
    },
    orderBy: { game_start: 'desc' },
    take: 50
  });

  return NextResponse.json({ matches });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { puuid, action } = body;

  const client = getRiotClient();
  if (!client) return NextResponse.json({ error: "Riot API key not configured" }, { status: 503 });

  try {
    if (action === "sync") {
      if (!puuid) return NextResponse.json({ error: "puuid required for sync" }, { status: 400 });

      const matchlist = await client.getMatchlist(puuid);
      let synced = 0;

      for (const entry of matchlist.history.slice(0, 10)) {
        const existing = await db.match.findUnique({ where: { riot_match_id: entry.matchId } });
        if (existing) continue;

        try {
          const matchData = await client.getMatch(entry.matchId);
          const map = findMapByUrl(matchData.matchInfo.mapId);

          const blueTeam = matchData.teams.find(t => t.teamId === "Blue");
          const redTeam = matchData.teams.find(t => t.teamId === "Red");

          // Create match and stats in a transaction
          const newMatch = await db.$transaction(async (tx) => {
            const m = await tx.match.create({
              data: {
                riot_match_id: matchData.matchInfo.matchId,
                map_id: matchData.matchInfo.mapId,
                map_name: map?.name || matchData.matchInfo.mapId,
                game_mode: matchData.matchInfo.gameMode,
                game_start: new Date(matchData.matchInfo.gameStartMillis),
                game_length_ms: matchData.matchInfo.gameLengthMillis,
                is_ranked: matchData.matchInfo.isRanked,
                queue_id: matchData.matchInfo.queueID,
                season_id: matchData.matchInfo.seasonId,
                team_blue_score: blueTeam?.roundsWon || 0,
                team_red_score: redTeam?.roundsWon || 0,
                team_blue_won: blueTeam?.won || false,
                raw_data: matchData as object
              }
            });

            for (const player of matchData.players) {
              const ourPlayer = await tx.player.findUnique({ where: { puuid: player.puuid } });
              
              await tx.matchPlayerStats.create({
                data: {
                  match_id: m.id,
                  puuid: player.puuid,
                  player_id: ourPlayer?.id || null,
                  character_id: player.characterId,
                  team_id: player.teamId,
                  kills: player.stats.kills,
                  deaths: player.stats.deaths,
                  assists: player.stats.assists,
                  score: player.stats.score,
                  rounds_played: player.stats.roundsPlayed,
                  competitive_tier: player.competitiveTier,
                  ability_casts: JSON.stringify(player.stats.abilityCasts)
                }
              });
            }

            return m;
          });

          // Auto-link to event
          const matchDate = new Date(matchData.matchInfo.gameStartMillis);
          const dateStr = matchDate.toISOString().split("T")[0];
          
          const unlinkedEvent = await db.event.findFirst({
            where: {
              date: dateStr,
              match_id: null,
              type: { in: ['match', 'premier'] }
            },
            orderBy: { time: 'asc' }
          });

          if (unlinkedEvent) {
            await db.event.update({
              where: { id: unlinkedEvent.id },
              data: { match_id: newMatch.riot_match_id, status: 'completed' }
            });
            await db.match.update({
              where: { id: newMatch.id },
              data: { event_id: unlinkedEvent.id }
            });
          }

          synced++;
        } catch (e) {
          console.error(`Failed to sync match ${entry.matchId}:`, e);
          continue;
        }
      }

      return NextResponse.json({ synced, total: matchlist.history.length });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
