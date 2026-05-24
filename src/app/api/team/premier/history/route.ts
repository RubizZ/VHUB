import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getPremierHistory } from "@/lib/henrik-api";
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

    const history = await getPremierHistory(pTeam.name, pTeam.tag);

    return NextResponse.json({
      history: history?.league_matches || []
    });
  } catch (error) {
    console.error("[API Premier History] Error:", error);
    return NextResponse.json({ error: "Error al obtener historial de Premier" }, { status: 500 });
  }
}
