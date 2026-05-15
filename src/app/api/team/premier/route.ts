import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getPremierTeam, getPremierHistory, getPremierLeaderboard } from "@/lib/henrik-api";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  const teamId = session?.user?.teamId;

  if (!teamId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId }
    });

    if (!team || !team.name || !team.tag) {
      console.log("[API Premier] Team config missing for ID:", teamId, { name: team?.name, tag: team?.tag });
      return NextResponse.json({ 
        error: "Configura el nombre y el tag de Premier en los ajustes de equipo",
        config_required: true 
      });
    }

    console.log("[API Premier] Fetching for:", team.name, team.tag);

    // Fetch data from Henrik API in parallel
    const [premierDetails, history, leaderboard] = await Promise.all([
      getPremierTeam(team.name, team.tag),
      getPremierHistory(team.name, team.tag),
      team.division ? getPremierLeaderboard('eu', team.conference, team.division) : Promise.resolve([])
    ]);

    if (!premierDetails) {
      console.log("[API Premier] Team not found in Henrik API:", team.name, team.tag);
      return NextResponse.json({ 
        error: `No se encontró el equipo "${team.name}#${team.tag}" en la API de Premier.`,
        config_required: true 
      });
    }

    console.log("[API Premier] Success for:", team.name);

    return NextResponse.json({
      details: premierDetails,
      history: history?.league_matches || [],
      leaderboard: Array.isArray(leaderboard) ? leaderboard : (leaderboard as any).leaderboard || [],
      config: {
        name: team.name,
        tag: team.tag,
        conference: team.conference,
        division: team.division
      }
    });
  } catch (error) {
    console.error("[API Premier] Error:", error);
    return NextResponse.json({ error: "Error al obtener datos de Premier" }, { status: 500 });
  }
}
