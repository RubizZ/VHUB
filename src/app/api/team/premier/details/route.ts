import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getPremierTeam, getPremierLeaderboard } from "@/lib/henrik-api";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  const teamId = session?.user?.teamId;

  if (!teamId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { premierTeam: true }
    });

    const pTeam = team?.premierTeam;

    if (!pTeam || !pTeam.name || !pTeam.tag) {
      return NextResponse.json({ 
        error: "Configura el nombre y el tag de Premier en los ajustes de equipo",
        config_required: true 
      });
    }

    const [premierDetails, leaderboard] = await Promise.all([
      getPremierTeam(pTeam.name, pTeam.tag),
      pTeam.division && pTeam.conference ? getPremierLeaderboard('eu', pTeam.conference, pTeam.division) : Promise.resolve([])
    ]);

    if (!premierDetails) {
      return NextResponse.json({ 
        error: `No se encontró el equipo "${pTeam.name}#${pTeam.tag}" en la API de Premier.`,
        config_required: true 
      });
    }

    return NextResponse.json({
      details: premierDetails,
      leaderboard: Array.isArray(leaderboard) ? leaderboard : (leaderboard as any).leaderboard || [],
      config: {
        name: pTeam.name,
        tag: pTeam.tag,
        conference: pTeam.conference,
        division: pTeam.division
      }
    });
  } catch (error) {
    console.error("[API Premier Details] Error:", error);
    return NextResponse.json({ error: "Error al obtener detalles de Premier" }, { status: 500 });
  }
}
