import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const players = await db.player.findMany({
    orderBy: { id: 'asc' }
  });
  return NextResponse.json({ players });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, riot_name, riot_tag, role, avatar_color, puuid } = body;
  
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  
  const player = await db.player.create({
    data: {
      name,
      riot_name: riot_name || "",
      riot_tag: riot_tag || "",
      role: role || "flex",
      avatar_color: avatar_color || "#FF4655",
      puuid: puuid || null
    }
  });
  
  return NextResponse.json({ id: player.id });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, name, riot_name, riot_tag, role, avatar_color, puuid } = body;
  
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  
  await db.player.update({
    where: { id: Number(id) },
    data: {
      name,
      riot_name,
      riot_tag,
      role,
      avatar_color,
      puuid
    }
  });
  
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  
  await db.player.delete({
    where: { id: Number(id) }
  });
  
  return NextResponse.json({ ok: true });
}
