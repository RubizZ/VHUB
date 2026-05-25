/* eslint-disable no-undef */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MAPS } from "@/lib/maps";
import { auth } from "@/auth";
import { getMatches, getPremierSeasons } from "@/lib/henrik-api";
import { getGameSeasons } from "@/lib/valorant-api";
import { Prisma } from "@prisma/client";

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
            orderBy: { score: 'desc' }
          }
        }
      });

      if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

      // Fetch all team players to check consent dynamically
      const teamPlayers = await db.player.findMany({
        where: { teamId },
        include: { user: { select: { dataConsent: true } } }
      });
      const playerMap = new Map(teamPlayers.map(p => [p.puuid, p]));

      // Check for at least one player consent dynamically
      const hasConsent = match.player_stats.some(s => {
        const p = playerMap.get(s.puuid);
        return p?.user?.dataConsent === true;
      });

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
        const teamPlayer = playerMap.get(s.puuid);
        const isConsenting = teamPlayer?.user?.dataConsent === true;

        let displayName = s.puuid.substring(0, 8);
        const isTeamMember = !!teamPlayer;

        if (pData?.name && pData?.tag) {
          displayName = `${pData.name}#${pData.tag}`;
        } else if (isTeamMember) {
          if (teamPlayer.riot_name && teamPlayer.riot_tag) {
            displayName = `${teamPlayer.riot_name}#${teamPlayer.riot_tag}`;
          } else if (teamPlayer.name) {
            displayName = teamPlayer.name;
          }
        }

        return {
          ...s,
          puuid: isConsenting ? s.puuid : s.puuid.substring(0, 8),
          player_name: displayName,
          avatar_color: isConsenting ? teamPlayer?.avatar_color : undefined,
          player_id: isConsenting ? teamPlayer?.id : null
        };
      });

      const ourSide = match.player_stats.find(s => {
        const p = playerMap.get(s.puuid);
        return p?.teamId === teamId;
      })?.team_id || "Blue";

      return NextResponse.json({ match: { ...match, our_team_side: ourSide }, playerStats });
    }

    // Case 2: Match List
    const whereClause: Prisma.MatchWhereInput = {
      teamId,
      // Restrict matches to ONLY Premier matches or team events (practices, matches, playoffs)
      OR: [
        { queue_id: { equals: "Premier", mode: "insensitive" } },
        { game_mode: { equals: "Premier", mode: "insensitive" } },
        {
          event: {
            type: { in: ["match", "practice", "playoffs"] }
          }
        }
      ]
    };

    // If a season is specified, we filter by it (which implies it's a Premier match)
    if (seasonParam && seasonParam !== 'all' && seasonParam !== "") {
      whereClause.premier_season_id = seasonParam;
    }

    const [matches, seasonsData, teamPlayers, teamEvents] = await Promise.all([
      db.match.findMany({
        where: whereClause,
        include: {
          player_stats: {
            select: { 
              team_id: true,
              puuid: true
            }
          },
          season: true // Traer info de la temporada
        },
        orderBy: { game_start: 'desc' },
        take: 50
      }),
      db.season.findMany({
        where: { matches: { some: { teamId } } },
        orderBy: { starts_at: 'desc' }
      }),
      db.player.findMany({
        where: { teamId },
        include: { user: { select: { dataConsent: true } } }
      }),
      db.event.findMany({
        where: { teamId }
      })
    ]);

    const seasons = seasonsData.map(s => ({ id: s.id, name: s.name }));
    const playerMap = new Map(teamPlayers.map(p => [p.puuid, p]));
    const eventMapById = new Map(teamEvents.map(e => [e.id, e]));
    const eventMapByMatchId = new Map(teamEvents.filter(e => e.match_id).map(e => [e.match_id!, e]));

    const formattedMatches = matches.map(m => {
      const hasConsent = m.player_stats.some(s => {
        const p = playerMap.get(s.puuid);
        return p?.user?.dataConsent === true;
      });

      // Find associated event
      let linkedEventObj = null;
      if (m.event_id && eventMapById.has(m.event_id)) {
        linkedEventObj = eventMapById.get(m.event_id);
      } else if (eventMapByMatchId.has(m.riot_match_id)) {
        linkedEventObj = eventMapByMatchId.get(m.riot_match_id);
      }

      const linkedEvent = linkedEventObj ? {
        id: linkedEventObj.id,
        title: linkedEventObj.title,
        type: linkedEventObj.type,
        date: linkedEventObj.date,
        time: linkedEventObj.time
      } : null;

      if (!hasConsent) {
        return {
          id: m.id,
          riot_match_id: m.riot_match_id,
          game_start: m.game_start,
          isHidden: true,
          reason: "Privacidad: Sin consentimiento",
          event: linkedEvent
        };
      }

      // Determinar qué bando es el nuestro (el que tiene jugadores que pertenecen a nuestro equipo)
      const ourSide = m.player_stats.find((s: any) => {
        const p = playerMap.get(s.puuid);
        return p?.teamId === teamId;
      })?.team_id || "Blue";

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
        team_blue_name: m.team_blue_name,
        team_red_name: m.team_red_name,
        team_blue_tag: m.team_blue_tag,
        team_red_tag: m.team_red_tag,
        team_blue_icon: m.team_blue_icon,
        team_red_icon: m.team_red_icon,
        event_id: m.event_id,
        premier_season_id: m.premier_season_id,
        our_team_side: ourSide,
        isHidden: false,
        event: linkedEvent
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
      const userId = session?.user.id;
      const requestingUser = await db.user.findUnique({
        where: { id: userId },
        include: { player: true }
      });

      const dbTeam = await db.team.findUnique({
        where: { id: teamId },
        include: { players: true, premierTeam: true }
      });

      if (!dbTeam) return NextResponse.json({ error: "Equipo no encontrado" }, { status: 400 });
      const ourPuuids = new Set(dbTeam.players.map(p => p.puuid).filter(Boolean));

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
        
        let valActs: any[] = [];
        try {
          const valRes = await getGameSeasons();
          valActs = (valRes || []).filter((s: any) => s.type === 'EAresSeasonType::Act');
        } catch (e) {
          console.warn("Failed to fetch valorant-api seasons", e);
        }

        if (seasons && seasons.length > 0) {
          for (const s of seasons) {
            const starts = s.starts_at ? new Date(s.starts_at) : null;
            const ends = s.ends_at ? new Date(s.ends_at) : null;
            
            let resolvedName = `Temporada ${s.id.substring(0, 8)}`;
            if (starts) {
              const startT = starts.getTime();
              const endT = ends ? ends.getTime() : startT + 1000000;
              const midT = startT + (endT - startT) / 2;
              const matched = valActs.find((act: any) => {
                const aStart = new Date(act.startTime).getTime();
                const aEnd = new Date(act.endTime).getTime();
                return midT >= aStart && midT <= aEnd;
              });
              if (matched) resolvedName = matched.title || matched.displayName || resolvedName;
            }

            await db.season.upsert({
              where: { id: s.id },
              update: {
                name: (s as any).name || resolvedName,
                starts_at: starts && !isNaN(starts.getTime()) ? starts : null,
                ends_at: ends && !isNaN(ends.getTime()) ? ends : null
              },
              create: {
                id: s.id,
                name: (s as any).name || resolvedName,
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

          const blueTeam = matchData.teams.blue;
          const redTeam = matchData.teams.red;

          const blueTeamName = blueTeam?.customization?.name || blueTeam?.roster?.name;
          const redTeamName = redTeam?.customization?.name || redTeam?.roster?.name;
          
          const blueTeamRiotTag = blueTeam?.roster?.tag || blueTeam?.customization?.tag;
          const redTeamRiotTag = redTeam?.roster?.tag || redTeam?.customization?.tag;

        if (existing) {
          // Update team link and opponent names if missing
          await db.match.update({ 
            where: { id: existing.id }, 
            data: { 
              teamId: existing.teamId || teamId,
              team_blue_name: existing.team_blue_name || blueTeamName,
              team_red_name: existing.team_red_name || redTeamName,
              team_blue_tag: existing.team_blue_tag || blueTeamRiotTag,
              team_red_tag: existing.team_red_tag || redTeamRiotTag,
              team_blue_icon: existing.team_blue_icon || blueTeam?.roster?.customization?.image || null,
              team_red_icon: existing.team_red_icon || redTeam?.roster?.customization?.image || null,
            } 
          });
          continue;
        }

        try {
          const map = MAPS.find(m => m.name.toLowerCase() === matchData.metadata.map.toLowerCase());

          const teamNameLower = dbTeam.name.toLowerCase();
          const teamTagLower = dbTeam.premierTeam?.tag ? dbTeam.premierTeam.tag.toLowerCase() : "";

          const matchesBlueName = 
            (blueTeamName && (blueTeamName.toLowerCase() === teamNameLower || blueTeamName.toLowerCase().includes(teamNameLower) || (teamTagLower && blueTeamName.toLowerCase() === teamTagLower))) ||
            (blueTeamRiotTag && teamTagLower && blueTeamRiotTag.toLowerCase() === teamTagLower);

          const matchesRedName = 
            (redTeamName && (redTeamName.toLowerCase() === teamNameLower || redTeamName.toLowerCase().includes(teamNameLower) || (teamTagLower && redTeamName.toLowerCase() === teamTagLower))) ||
            (redTeamRiotTag && teamTagLower && redTeamRiotTag.toLowerCase() === teamTagLower);
          
          let playersInMatch = 0;
          for (const p of matchData.players.all_players) {
            if (ourPuuids.has(p.puuid)) {
              playersInMatch++;
            }
          }

          const isOurTeamByPlayers = playersInMatch >= 2;
          const isOurTeamByName = matchesBlueName || matchesRedName;

          if (!isOurTeamByPlayers && !isOurTeamByName) {
            console.log(`[Sync] Partido ${matchData.metadata.matchid} descartado. No coincide el nombre (${blueTeamName}, ${redTeamName} != ${dbTeam.name}) y solo hubo ${playersInMatch} jugador(es) del roster actual.`);
            continue;
          }

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
                team_blue_name: blueTeamName,
                team_red_name: redTeamName,
                team_blue_tag: blueTeamRiotTag,
                team_red_tag: redTeamRiotTag,
                team_blue_icon: blueTeam?.roster?.customization?.image || null,
                team_red_icon: redTeam?.roster?.customization?.image || null,
                raw_data: matchData as object
              }
            });

            for (const playerStats of matchData.players.all_players) {
              // Vinculamos el player_id incondicionalmente si el jugador existe en nuestro sistema
              const ourPlayer = await tx.player.findUnique({
                where: { puuid: playerStats.puuid }
              });
              const agent = await tx.agent.findFirst({
                where: { name: { equals: playerStats.character, mode: "insensitive" } }
              });

              await tx.matchPlayerStats.create({
                data: {
                  match_id: m.id,
                  puuid: playerStats.puuid,
                  player_id: ourPlayer?.id || null, // Link incondicional
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
            // y dentro de una ventana razonable (4 horas, o 8 horas para playoffs)
            const diff = gameStartHour - evHour;
            const maxDiff = ev.type === 'playoffs' ? 8 : 4;
            if (diff >= -1 && diff < maxDiff && diff < bestDiff) {
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


