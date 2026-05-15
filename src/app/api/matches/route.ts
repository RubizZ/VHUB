import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRiotClient } from "@/lib/riot/client";
import { findMapByUrl } from "@/lib/maps";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  const teamId = session?.user?.teamId;
  if (!teamId) return NextResponse.json({ error: "No team context" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("id");

  if (matchId) {
    const match = await db.match.findFirst({
      where: {
        teamId,
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

    // Verificamos si hay consentimiento de al menos un jugador
    const hasConsent = match.player_stats.some(s => s.player_id !== null);

    if (!hasConsent) {
      return NextResponse.json({ 
        match: {
          id: match.id,
          riot_match_id: match.riot_match_id,
          game_start: match.game_start,
          isHidden: true,
          reason: "Este partido está oculto porque ningún jugador del equipo ha dado su consentimiento para compartir datos en V-HUB."
        },
        playerStats: []
      });
    }

    // Transform player stats to match previous API format
    const playerStats = match.player_stats.map(s => ({
      ...s,
      player_name: s.player?.name,
      avatar_color: s.player?.avatar_color
    }));

    return NextResponse.json({ match, playerStats });
  }

  const matches = await db.match.findMany({
    where: { teamId },
    include: {
      player_stats: {
        select: { player_id: true },
        where: { player_id: { not: null } },
        take: 1
      }
    },
    orderBy: { game_start: 'desc' },
    take: 50
  });

  const formattedMatches = matches.map(m => {
    const hasConsent = m.player_stats.length > 0;
    if (!hasConsent) {
      return {
        id: m.id,
        riot_match_id: m.riot_match_id,
        game_start: m.game_start,
        isHidden: true,
        reason: "Privacidad: Sin consentimiento"
      };
    }
    return {
      id: m.id,
      riot_match_id: m.riot_match_id,
      map_name: m.map_name,
      game_mode: m.game_mode,
      game_start: m.game_start,
      game_length_ms: m.game_length_ms,
      queue_id: m.queue_id,
      team_blue_score: m.team_blue_score,
      team_red_score: m.team_red_score,
      team_blue_won: m.team_blue_won,
      event_id: m.event_id,
      isHidden: false
    };
  });

  return NextResponse.json({ matches: formattedMatches });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const teamId = session?.user?.teamId;
  if (!teamId) return NextResponse.json({ error: "No team context" }, { status: 400 });

  const body = await req.json();
  const { puuid, action } = body;

  const client = getRiotClient();
  if (!client) return NextResponse.json({ error: "Riot API key not configured" }, { status: 503 });

  try {
    if (action === "sync") {
      if (!puuid) return NextResponse.json({ error: "puuid required for sync" }, { status: 400 });

      // Verificar consentimiento del usuario autenticado
      const userId = session.user.id;
      const requestingUser = await db.user.findUnique({
        where: { id: userId }
      });

      if (!requestingUser?.dataConsent) {
        return NextResponse.json({ 
          error: "No has dado tu consentimiento para procesar tus datos de juego. Actívalo en tu perfil." 
        }, { status: 403 });
      }

      const matchlist = await client.getMatchlist(puuid);
      let synced = 0;

      for (const entry of matchlist.history.slice(0, 10)) {
        const existing = await db.match.findUnique({ 
          where: { riot_match_id: entry.matchId } 
        });
        
        if (existing) {
          if (!existing.teamId) {
            await db.match.update({ where: { id: existing.id }, data: { teamId } });
            synced++;
          }
          continue;
        }

        try {
          const matchData = await client.getMatch(entry.matchId);
          const map = findMapByUrl(matchData.matchInfo.mapId);

          const blueTeam = matchData.teams.find(t => t.teamId === "Blue");
          const redTeam = matchData.teams.find(t => t.teamId === "Red");

          // Create match and stats in a transaction
          const newMatch = await db.$transaction(async (tx) => {
            const m = await tx.match.create({
              data: {
                teamId,
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
              // Solo vinculamos estadísticas si el jugador existe en nuestro sistema Y ha dado su consentimiento
              const ourPlayer = await tx.player.findUnique({ 
                where: { puuid: player.puuid },
                include: { user: true }
              });
              
              const hasConsent = ourPlayer?.user?.dataConsent === true;

              await tx.matchPlayerStats.create({
                data: {
                  match_id: m.id,
                  puuid: player.puuid,
                  player_id: hasConsent ? ourPlayer?.id : null, // Solo vinculamos si hay consentimiento
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
              teamId,
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
