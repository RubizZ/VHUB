/* eslint-disable no-undef */
import { NextRequest, NextResponse } from "next/server";
import { getAccount, getMatches, getMMR } from "@/lib/henrik-api";
import { analyzeHenrikPlayerStats } from "@/lib/henrik-stats-analyzer";
import { db } from "@/lib/db";
import { MAPS } from "@/lib/maps";
import { findAgentByName } from "@/lib/agents";
import { HenrikMatch } from "@/lib/henrik-types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "status";

  try {
    switch (action) {
      case "status": {
        return NextResponse.json({ status: "available", configured: true });
      }
      case "stats": {
        const name = searchParams.get("name");
        const tag = searchParams.get("tag");
        const region = searchParams.get("region") || "eu";
        const seasonId = searchParams.get("season") || "all";
        
        if (!name || !tag) return NextResponse.json({ error: "name and tag required" }, { status: 400 });

        // Verificar consentimiento en base de datos
        const dbPlayer = await db.player.findFirst({
          where: {
            riot_name: { equals: name, mode: "insensitive" },
            riot_tag: { equals: tag, mode: "insensitive" }
          },
          include: { user: { select: { dataConsent: true } } }
        });

        if (dbPlayer && dbPlayer.user?.dataConsent !== true) {
          return NextResponse.json({
            error: "consent_required",
            message: "Este jugador no ha dado su consentimiento para procesar y mostrar sus estadísticas de juego en VHUB."
          }, { status: 403 });
        }

        // Obtener PUUID del jugador (desde DB o haciendo un getAccount de fallback)
        let playerPuuid = dbPlayer?.puuid;
        let teamId = dbPlayer?.teamId || null;

        if (!playerPuuid) {
          try {
            const acc = await getAccount(name, tag);
            playerPuuid = acc?.puuid;
          } catch (e) {
            console.warn("[API Stats] Failed to fetch PUUID from Henrik:", e);
          }
        }

        // 1. Obtener Historial de partidas por cada modo de juego de Henrik para sortear el límite de 10 por llamada
        const modesToSync = ["competitive", "premier", "unrated", "deathmatch"];
        const fetchedMatches: HenrikMatch[] = [];

        try {
          for (const mode of modesToSync) {
            try {
              // Pequeño retardo de 100ms para evitar rate-limit
              await new Promise(resolve => setTimeout(resolve, 100));
              const fetched = await getMatches(region, name, tag, mode, 10);
              if (fetched && fetched.length > 0) {
                fetchedMatches.push(...fetched);
              }
            } catch (err) {
              console.warn(`[API Stats] Failed to fetch mode ${mode}:`, err);
            }
          }
        } catch (e) {
          console.error("[API Stats] Error fetching matches from Henrik:", e);
        }

        // Filtrar duplicados por match ID
        const uniqueMatchesMap = new Map<string, HenrikMatch>();
        for (const m of fetchedMatches) {
          uniqueMatchesMap.set(m.metadata.matchid, m);
        }
        const matches = Array.from(uniqueMatchesMap.values());

        // 2. Guardar y sincronizar las partidas en nuestra base de datos local
        if (matches && matches.length > 0) {
          for (const matchData of matches) {
            const existing = await db.match.findUnique({
              where: { riot_match_id: matchData.metadata.matchid }
            });

            if (!existing) {
              try {
                const map = MAPS.find(m => m.name.toLowerCase() === matchData.metadata.map.toLowerCase());
                const blueTeam = matchData.teams?.blue;
                const redTeam = matchData.teams?.red;

                await db.$transaction(async (tx) => {
                  let premierSeasonId = matchData.metadata.premier_info?.season_id || (matchData as any).metadata.premier_section?.season_id || null;

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
                    const ourPlayer = await tx.player.findUnique({
                      where: { puuid: playerStats.puuid }
                    });
                    const agent = findAgentByName(playerStats.character);

                    await tx.matchPlayerStats.create({
                      data: {
                        match_id: m.id,
                        puuid: playerStats.puuid,
                        player_id: ourPlayer?.id || null,
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
                });
              } catch (e) {
                console.error(`[API Stats] Failed to upsert match ${matchData.metadata.matchid}:`, e);
              }
            } else if (!existing.teamId && teamId) {
              await db.match.update({
                where: { id: existing.id },
                data: { teamId }
              });
            }
          }
        }

        // 3. Consultar todo el historial acumulado en la base de datos para este jugador
        let matchesToAnalyze = matches;
        let playedSeasons: Array<{ id: string; name: string }> = [];

        if (playerPuuid) {
          const matchesWhereClause: any = {
            player_stats: {
              some: { puuid: playerPuuid }
            }
          };

          if (seasonId !== "all" && seasonId !== "") {
            matchesWhereClause.premier_season_id = seasonId;
          }

          const dbMatches = await db.match.findMany({
            where: matchesWhereClause,
            orderBy: { game_start: 'desc' }
          });

          if (dbMatches && dbMatches.length > 0) {
            matchesToAnalyze = dbMatches
              .map(m => m.raw_data as any)
              .filter(Boolean) as HenrikMatch[];
          }

          // Consultar las temporadas en las que tiene partidos guardados
          const seasons = await db.season.findMany({
            where: {
              matches: {
                some: {
                  player_stats: {
                    some: { puuid: playerPuuid }
                  }
                }
              }
            },
            orderBy: { starts_at: 'desc' }
          });
          playedSeasons = seasons.map(s => ({ id: s.id, name: s.name }));
        }

        // 4. Obtener MMR (Rango actual)
        const mmrData = await getMMR(region, name, tag);
        const mmr = mmrData ? {
          currenttierpatched: mmrData.current_data.currenttierpatched,
          ranking_in_tier: mmrData.current_data.ranking_in_tier,
          mmr_change_to_last_game: mmrData.current_data.mmr_change_to_last_game,
          elo: mmrData.current_data.elo
        } : null;

        // 5. Analizar estadísticas con el set completo acumulado
        const stats = analyzeHenrikPlayerStats(matchesToAnalyze, name, tag);

        return NextResponse.json({
          stats,
          mmr,
          matches: matchesToAnalyze.slice(0, 10), // Devolvemos las 10 más recientes para el historial visual
          seasons: playedSeasons,
          mock: false,
          configured: true
        });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, configured: true }, { status: 500 });
  }
}
