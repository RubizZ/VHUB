import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  const teamId = session?.user?.teamId;
  if (!teamId) return NextResponse.json({ error: "No team context" }, { status: 400 });

  const events = await db.event.findMany({
    where: { teamId },
    orderBy: [
      { date: 'asc' },
      { time: 'asc' }
    ]
  });
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = session?.user?.role;
  const teamId = session?.user?.teamId;

  if (role !== "team_admin" && role !== "super_admin") {
    return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
  }

  if (!teamId) return NextResponse.json({ error: "No team context" }, { status: 400 });

  const body = await req.json();
  const { title, type, date, time, description, map, premier_week } = body;
  
  if (!title || !date || !time) return NextResponse.json({ error: "Title, date and time required" }, { status: 400 });
  
  const event = await db.event.create({
    data: {
      teamId,
      title,
      type: type || "match",
      date,
      time,
      description: description || "",
      map: map || "",
      premier_week: premier_week || null
    }
  });
  
  return NextResponse.json({ id: event.id });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  const teamId = session?.user?.teamId;

  const body = await req.json();
  const { id, status, match_id } = body;
  
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  // Validar pertenencia al equipo
  const existingEvent = await db.event.findUnique({ where: { id: Number(id) } });
  if (!existingEvent || existingEvent.teamId !== teamId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  
  await db.event.update({
    where: { id: Number(id) },
    data: {
      status: status || undefined,
      match_id: match_id || undefined
    }
  });
  
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  const role = session?.user?.role;
  const teamId = session?.user?.teamId;

  if (role !== "team_admin" && role !== "super_admin") return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const existingEvent = await db.event.findUnique({ where: { id: Number(id) } });
  if (!existingEvent || existingEvent.teamId !== teamId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  
  await db.event.delete({
    where: { id: Number(id) }
  });
  
  return NextResponse.json({ ok: true });
}
