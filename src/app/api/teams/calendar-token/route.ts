import { db } from "@/lib/db";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  const teamId = session?.user?.teamId;

  if (!teamId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let team = await db.team.findUnique({
    where: { id: teamId },
    select: { calendarToken: true }
  });

  if (!team) {
    return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
  }

  // Si no tiene token, lo generamos uno
  if (!team.calendarToken) {
    const newToken = crypto.randomUUID();
    team = await db.team.update({
      where: { id: teamId },
      data: { calendarToken: newToken },
      select: { calendarToken: true }
    });
  }

  return NextResponse.json({ token: team.calendarToken });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const teamId = session?.user?.teamId;
  const role = session?.user?.role;

  if (role !== "team_admin" && role !== "super_admin") {
    return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
  }

  if (!teamId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const newToken = crypto.randomUUID();
  await db.team.update({
    where: { id: teamId },
    data: { calendarToken: newToken }
  });

  return NextResponse.json({ token: newToken });
}
