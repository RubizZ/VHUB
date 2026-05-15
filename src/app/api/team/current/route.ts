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
      where: { id: session.user.teamId }
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
    const { name, logo_url } = body;

    const updatedTeam = await prisma.team.update({
      where: { id: session.user.teamId },
      data: { name, logo_url }
    });

    return NextResponse.json({ team: updatedTeam });
  } catch (error) {
    return NextResponse.json({ error: "Error al actualizar el equipo" }, { status: 500 });
  }
}
