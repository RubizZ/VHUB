import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRiotClient } from "@/lib/riot/client";
import { findMapByUrl, MAPS } from "@/lib/maps";
import { auth } from "@/auth";
import { getMatches, getMatchById, getPremierSeasons } from "@/lib/henrik-api";
import { findAgentByName } from "@/lib/agents";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const teamId = session?.user?.teamId as string | undefined;
    if (!teamId) return NextResponse.json({ error: "No team context" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const matchId = searchParams.get("id");
    const seasonParam = searchParams.get("season");

    // Case 1: Single Match Details
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
              player: { select: { name: true, riot_name: true, riot_tag: true, avatar_color: true } }
            },
            orderBy: { score: 'desc' }
          }
        }
      });

      if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

      // Check for at least one player consent
      const hasConsent = match.player_stats.some(s => s.player_id !== null);

      if (!hasConsent) {
        return NextResponse.json({
          match: {
            id: match.id,
            riot_match_id: match.riot_match_id,
            game_start: match.game_start,
            isHidden: true,
            reason: "Este partido está oculto por falta de consentimiento de datos."
          },
          playerStats: []
        });
      }

      const playerStats = match.player_stats.map(s => {
        // Intentar obtener el Riot ID de los datos brutos de la partida (Henrik API)
        const rawData = match.raw_data as any;
        const pData = rawData?.players?.all_players?.find((p: any) => p.puuid === s.puuid);

        let displayName = s.puuid.substring(0, 8);
        if (pData?.name && pData?.tag) {
          displayName = `${pData.name}#${pData.tag}`;
        } else if (s.player?.riot_name && s.player?.riot_tag) {
          displayName = `${s.player.riot_name}#${s.player.riot_tag}`;
        } else if (s.player?.name) {
          displayName = s.player.name;
        }

        return {
          ...s,
          player_name: displayName,
          avatar_color: s.player?.avatar_color
        };
      });

      const ourSide = match.player_stats.find(s => s.player_id !== null)?.team_id || "Blue";

      return NextResponse.json({ match: { ...match, our_team_side: ourSide }, playerStats });
    }

    // Case 2: Match List
    const whereClause: any = {
      teamId
    };

    // If a season is specified, we filter by it (which implies it's a Premier match)
    if (seasonParam && seasonParam !== 'all' && seasonParam !== "") {
      whereClause.premier_season_id = seasonParam;
    }

    const [matches, seasonsData] = await Promise.all([
      db.match.findMany({
        where: whereClause,
        include: {
          player_stats: {
            select: { player_id: true },
            where: { player_id: { not: null } },
            take: 1
          },
          season: true // Traer info de la temporada
        },
        orderBy: { game_start: 'desc' },
        take: 50
      }),
      db.season.findMany({
        where: { matches: { some: { teamId } } },
        orderBy: { starts_at: 'desc' }
      })
    ]);

    const seasons = seasonsData.map(s => ({ id: s.id, name: s.name }));

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

      // Determinar qué bando es el nuestro (el que tiene jugadores vinculados)
      // En la query usamos include con un take: 1 de player_stats donde player_id != null
      const ourSide = m.player_stats[0]?.team_id || "Blue";

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
        premier_season_id: m.premier_season_id,
        our_team_side: ourSide,
        isHidden: false
      };
    });

    // Identificar temporada activa
    const nowTime = new Date();
    const activeSeason = await db.season.findFirst({
      where: {
        starts_at: { lte: nowTime },
        ends_at: { gte: nowTime }
      },
      select: { id: true }
    });

    return NextResponse.json({ 
      matches: formattedMatches,
      seasons: seasons || [],
      activeSeasonId: activeSeason?.id || (seasons.length > 0 ? seasons[0].id : "")
    });
  } catch (err) {
    console.error("[API Matches GET] CRITICAL ERROR:", err);
    return NextResponse.json({
      error: "Error al recuperar los partidos",
      details: err instanceof Error ? err.message : String(err)
    }, { status: 500 });
  }
}



export async function POST(req: NextRequest) {
  const session = await auth();
  const teamId = session?.user?.teamId as string | undefined;
  if (!teamId) return NextResponse.json({ error: "No team context" }, { status: 400 });

  const body = await req.json();
  const { puuid, action } = body;

  try {
    if (action === "sync") {
      if (!puuid) return NextResponse.json({ error: "puuid required for sync" }, { status: 400 });

      // Verificar consentimiento del usuario autenticado
      const userId = session.user.id;
      const requestingUser = await db.user.findUnique({
        where: { id: userId },
        include: { player: true }
      });

      if (!requestingUser?.dataConsent) {
        return NextResponse.json({
          error: "No has dado tu consentimiento para procesar tus datos de juego. Actívalo en tu perfil."
        }, { status: 403 });
      }

      // Obtenemos las últimas 10 partidas usando HenrikDev (V3 devuelve el objeto completo)
      // Usamos la región del jugador o 'eu' por defecto
      const region = 'eu';
      const player = requestingUser.player;
      if (!player?.riot_name || !player?.riot_tag) {
        return NextResponse.json({ error: "El jugador no tiene un Riot ID configurado" }, { status: 400 });
      }

      const matchlist = await getMatches(region, player.riot_name, player.riot_tag, 'premier', 20);
      if (!matchlist) return NextResponse.json({ error: "No se pudieron obtener las partidas de HenrikDev" }, { status: 502 });

      // Asegurar que las temporadas existan antes de procesar partidas
      try {
        console.log("[API Matches Sync] Sincronizando metadatos de temporadas...");
        const seasons = await getPremierSeasons('eu');
        if (seasons && seasons.length > 0) {
          for (const s of seasons) {
            const starts = s.starts_at ? new Date(s.starts_at) : null;
            const ends = s.ends_at ? new Date(s.ends_at) : null;
            await db.season.upsert({
              where: { id: s.id },
              update: {
                name: (s as any).name || `Temporada ${s.id.substring(0, 8)}`,
                starts_at: starts && !isNaN(starts.getTime()) ? starts : null,
                ends_at: ends && !isNaN(ends.getTime()) ? ends : null
              },
              create: {
                id: s.id,
                name: (s as any).name || `Temporada ${s.id.substring(0, 8)}`,
                starts_at: starts && !isNaN(starts.getTime()) ? starts : null,
                ends_at: ends && !isNaN(ends.getTime()) ? ends : null
              }
            });
          }
        }
      } catch (e) {
        console.warn("[API Matches Sync] Failed to sync seasons metadata:", e);
      }

      let synced = 0;

      for (const matchData of matchlist) {
        const existing = await db.match.findUnique({
          where: { riot_match_id: matchData.metadata.matchid }
        });

        if (existing) {
          if (!existing.teamId) {
            await db.match.update({ where: { id: existing.id }, data: { teamId } });
            synced++;
          }
          continue;
        }

        try {
          const map = MAPS.find(m => m.name.toLowerCase() === matchData.metadata.map.toLowerCase());

          const blueTeam = matchData.teams.blue;
          const redTeam = matchData.teams.red;

          // Create match and stats in a transaction
          const newMatch = await db.$transaction(async (tx) => {
            let premierSeasonId = matchData.metadata.premier_info?.season_id || (matchData as any).metadata.premier_section?.season_id || null;

            // FALLBACK: Si no viene el ID de la temporada, intentamos buscarla por fecha
            if (!premierSeasonId) {
              const gameDate = new Date(matchData.metadata.game_start * 1000);
              const matchingSeason = await tx.season.findFirst({
                where: {
                  starts_at: { lte: gameDate },
                  ends_at: { gte: gameDate }
                }
              });
              if (matchingSeason) {
                premierSeasonId = matchingSeason.id;
              }
            }

            const m = await tx.match.create({
              data: {
                teamId,
                riot_match_id: matchData.metadata.matchid,
                map_id: map?.id || "", 
                map_name: matchData.metadata.map,
                game_mode: matchData.metadata.mode,
                game_start: new Date(matchData.metadata.game_start * 1000),
                game_length_ms: matchData.metadata.game_length * 1000,
                is_ranked: matchData.metadata.queue === 'Competitive',
                queue_id: matchData.metadata.queue,
                season_id: matchData.metadata.season_id,
                premier_season_id: premierSeasonId,
                team_blue_score: blueTeam?.rounds_won || 0,
                team_red_score: redTeam?.rounds_won || 0,
                team_blue_won: blueTeam?.has_won || false,
                raw_data: matchData as object
              }
            });

            for (const playerStats of matchData.players.all_players) {
              // Solo vinculamos estadísticas si el jugador existe en nuestro sistema Y ha dado su consentimiento
              const ourPlayer = await tx.player.findUnique({
                where: { puuid: playerStats.puuid },
                include: { user: true }
              });

              const hasConsent = ourPlayer?.user?.dataConsent === true;
              const agent = findAgentByName(playerStats.character);

              await tx.matchPlayerStats.create({
                data: {
                  match_id: m.id,
                  puuid: playerStats.puuid,
                  player_id: hasConsent ? ourPlayer?.id : null,
                  character_id: agent?.id || playerStats.character,
                  team_id: playerStats.team,
                  kills: playerStats.stats?.kills || 0,
                  deaths: playerStats.stats?.deaths || 0,
                  assists: playerStats.stats?.assists || 0,
                  score: playerStats.stats?.score || 0,
                  rounds_played: matchData.metadata.rounds_played || 0,
                  competitive_tier: playerStats.currenttier,
                  ability_casts: playerStats.ability_casts as object
                }
              });
            }

            return m;
          });

          // Auto-link to event: un partido se vincula a un evento si su game_start
          // cae en la misma fecha del evento y dentro de la ventana de tiempo razonable.
          // Pueden haber varios partidos por evento.
          const gameStartDate = new Date(matchData.metadata.game_start * 1000);
          const dateStr = gameStartDate.toISOString().split("T")[0];
          const gameStartHour = gameStartDate.getUTCHours();

          // Buscar todos los eventos del equipo en esa fecha (match/practice/playoffs)
          const candidateEvents = await db.event.findMany({
            where: {
              teamId,
              date: dateStr,
              type: { in: ['match', 'practice', 'playoffs'] }
            },
            orderBy: { time: 'asc' }
          });

          // Vincular al evento cuya hora de inicio esté más cerca del game_start
          // (la ventana de registro suele ser ~15min antes del partido, 
          // y los partidos pueden durar horas, así que usamos una ventana generosa)
          let bestEvent = null;
          let bestDiff = Infinity;

          for (const ev of candidateEvents) {
            const evHour = parseInt(ev.time.split(':')[0], 10);
            // El partido debería empezar después del evento (o en la misma hora)
            // y dentro de una ventana razonable (4 horas)
            const diff = gameStartHour - evHour;
            if (diff >= -1 && diff < 4 && diff < bestDiff) {
              bestDiff = diff;
              bestEvent = ev;
            }
          }

          if (bestEvent) {
            // Actualizar match con event_id
            await db.match.update({
              where: { id: newMatch.id },
              data: { event_id: bestEvent.id }
            });
            // Actualizar event: poner match_id si no tiene (para backward compat),
            // y marcar como completed
            if (!bestEvent.match_id) {
              await db.event.update({
                where: { id: bestEvent.id },
                data: { match_id: newMatch.riot_match_id, status: 'completed' }
              });
            } else {
              await db.event.update({
                where: { id: bestEvent.id },
                data: { status: 'completed' }
              });
            }
          }

          synced++;
        } catch (e) {
          console.error(`Failed to sync match ${matchData.metadata.matchid}:`, e);
          continue;
        }
      }

      return NextResponse.json({ synced, total: matchlist.length });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[API Matches POST] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


