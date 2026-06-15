import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  if (!session?.user?.teamId) {
    return NextResponse.json({ error: "No autorizado o sin equipo" }, { status: 401 });
  }

  try {
    const team = await prisma.team.findUnique({
      where: { id: session.user.teamId },
      include: { premierTeam: true }
    });

    return NextResponse.json({ team });
  } catch (error) {
    return NextResponse.json({ error: "Error al obtener el equipo" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await auth();

  if (!session?.user?.teamId || (session.user.role !== "team_admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, logo_url, premier_name, tag, division, conference, defaultStrategyShowTrajectories } = body;

    const updatedTeam = await prisma.team.update({
      where: { id: session.user.teamId },
      data: { 
        name, 
        logo_url,
        ...(defaultStrategyShowTrajectories !== undefined && { defaultStrategyShowTrajectories })
      },
      include: { premierTeam: true }
    });

    if (premier_name || tag || division !== undefined || conference) {
      await prisma.premierTeam.upsert({
        where: { teamId: session.user.teamId },
        create: {
          teamId: session.user.teamId,
          name: premier_name || name,
          tag: tag || "TAG",
          conference: conference || "NONE",
          division: division ? Number(division) : null,
        },
        update: {
          ...(premier_name !== undefined && { name: premier_name }),
          ...(tag !== undefined && { tag }),
          ...(conference !== undefined && { conference }),
          ...(division !== undefined && { division: division ? Number(division) : null }),
        }
      });
    }

    return NextResponse.json({ team: updatedTeam });
  } catch (error) {
    return NextResponse.json({ error: "Error al actualizar el equipo" }, { status: 500 });
  }
}
