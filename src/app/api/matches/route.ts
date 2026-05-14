import { NextRequest, NextResponse } from "next/server";
import { query, dbReady } from "@/lib/db";
import { getRiotClient } from "@/lib/riot/client";
import { findMapByUrl } from "@/lib/maps";

export async function GET(req: NextRequest) {
  await dbReady;
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("id");

  if (matchId) {
    // Fetch single match with player stats
    const match = await query("SELECT * FROM matches WHERE id = $1 OR riot_match_id = $1", [matchId]);
    if (!match[0]) return NextResponse.json({ error: "Match not found" }, { status: 404 });

    const stats = await query(
      `SELECT mps.*, p.name as player_name, p.avatar_color
       FROM match_player_stats mps
       LEFT JOIN players p ON mps.player_id = p.id
       WHERE mps.match_id = $1
       ORDER BY mps.score DESC`,
      [match[0].id]
    );

    return NextResponse.json({ match: match[0], playerStats: stats });
  }

  // List all cached matches
  const matches = await query(
    "SELECT id, riot_match_id, map_name, game_mode, game_start, game_length_ms, queue_id, team_blue_score, team_red_score, team_blue_won, event_id FROM matches ORDER BY game_start DESC LIMIT 50"
  );
  return NextResponse.json({ matches });
}

export async function POST(req: NextRequest) {
  await dbReady;
  const body = await req.json();
  const { puuid, action } = body;

  const client = getRiotClient();
  if (!client) {
    return NextResponse.json({ error: "Riot API key not configured" }, { status: 503 });
  }

  try {
    if (action === "sync") {
      // Sync matches for a player
      if (!puuid) return NextResponse.json({ error: "puuid required for sync" }, { status: 400 });

      const matchlist = await client.getMatchlist(puuid);
      let synced = 0;

      for (const entry of matchlist.history.slice(0, 10)) {
        // Check if already cached
        const existing = await query("SELECT id FROM matches WHERE riot_match_id = $1", [entry.matchId]);
        if (existing.length > 0) continue;

        try {
          const matchData = await client.getMatch(entry.matchId);
          const map = findMapByUrl(matchData.matchInfo.mapId);

          // Store match
          const inserted = await query(
            `INSERT INTO matches (riot_match_id, map_id, map_name, game_mode, game_start, game_length_ms, is_ranked, queue_id, season_id, raw_data)
             VALUES ($1, $2, $3, $4, to_timestamp($5::double precision / 1000), $6, $7, $8, $9, $10)
             ON CONFLICT (riot_match_id) DO NOTHING
             RETURNING id`,
            [
              matchData.matchInfo.matchId,
              matchData.matchInfo.mapId,
              map?.name || matchData.matchInfo.mapId,
              matchData.matchInfo.gameMode,
              matchData.matchInfo.gameStartMillis,
              matchData.matchInfo.gameLengthMillis,
              matchData.matchInfo.isRanked,
              matchData.matchInfo.queueID,
              matchData.matchInfo.seasonId,
              JSON.stringify(matchData),
            ]
          );

          if (inserted[0]) {
            const dbMatchId = inserted[0].id;

            // Calculate team scores
            const blueTeam = matchData.teams.find((t) => t.teamId === "Blue");
            const redTeam = matchData.teams.find((t) => t.teamId === "Red");

            await query(
              "UPDATE matches SET team_blue_score=$1, team_red_score=$2, team_blue_won=$3 WHERE id=$4",
              [blueTeam?.roundsWon || 0, redTeam?.roundsWon || 0, blueTeam?.won || false, dbMatchId]
            );

            // Store player stats
            for (const player of matchData.players) {
              // Try to link with our players
              const ourPlayer = await query("SELECT id FROM players WHERE puuid = $1", [player.puuid]);

              await query(
                `INSERT INTO match_player_stats (match_id, puuid, player_id, character_id, team_id, kills, deaths, assists, score, rounds_played, competitive_tier, ability_casts)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                 ON CONFLICT (match_id, puuid) DO NOTHING`,
                [
                  dbMatchId,
                  player.puuid,
                  ourPlayer[0]?.id || null,
                  player.characterId,
                  player.teamId,
                  player.stats.kills,
                  player.stats.deaths,
                  player.stats.assists,
                  player.stats.score,
                  player.stats.roundsPlayed,
                  player.competitiveTier,
                  JSON.stringify(player.stats.abilityCasts),
                ]
              );
            }

            // Auto-link to event by date
            const matchDate = new Date(matchData.matchInfo.gameStartMillis);
            const dateStr = matchDate.toISOString().split("T")[0];
            const unlinkedEvents = await query(
              "SELECT id FROM events WHERE date = $1 AND match_id IS NULL AND type IN ('match', 'premier') ORDER BY time ASC LIMIT 1",
              [dateStr]
            );
            if (unlinkedEvents[0]) {
              await query("UPDATE events SET match_id=$1, status='completed' WHERE id=$2", [
                matchData.matchInfo.matchId,
                unlinkedEvents[0].id,
              ]);
              await query("UPDATE matches SET event_id=$1 WHERE id=$2", [unlinkedEvents[0].id, dbMatchId]);
            }

            synced++;
          }
        } catch {
          // Skip failed matches (rate limit, etc.)
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
