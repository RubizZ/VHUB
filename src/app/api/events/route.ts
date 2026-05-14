import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const events = await db.event.findMany({
    orderBy: [
      { date: 'asc' },
      { time: 'asc' }
    ]
  });
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, type, date, time, description, map, premier_week } = body;
  
  if (!title || !date || !time) return NextResponse.json({ error: "Title, date and time required" }, { status: 400 });
  
  const event = await db.event.create({
    data: {
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
  const body = await req.json();
  const { id, status, match_id } = body;
  
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  
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
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  
  await db.event.delete({
    where: { id: Number(id) }
  });
  
  return NextResponse.json({ ok: true });
}
