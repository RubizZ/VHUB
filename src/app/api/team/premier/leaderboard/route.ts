import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getPremierLeaderboard, getPremierTeam } from "@/lib/external/henrik/henrik-api";
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

    // Leaderboard might need the details to find exactly the ID if it's not saved locally
    const [premierDetails, leaderboard] = await Promise.all([
      getPremierTeam(pTeam.name, pTeam.tag),
      pTeam.division && pTeam.conference ? getPremierLeaderboard('eu', pTeam.conference, pTeam.division) : Promise.resolve([])
    ]);

    return NextResponse.json({
      leaderboard: Array.isArray(leaderboard) ? leaderboard : (leaderboard as any).leaderboard || [],
      details: premierDetails
    });
  } catch (error) {
    console.error("[API Premier Leaderboard] Error:", error);
    return NextResponse.json({ error: "Error al obtener la clasificación de Premier" }, { status: 500 });
  }
}
