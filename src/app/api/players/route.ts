import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const players = db.prepare("SELECT * FROM players ORDER BY id").all();
  return NextResponse.json({ players });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, riot_name, riot_tag, role, avatar_color } = body;
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const db = getDb();
  const result = db.prepare("INSERT INTO players (name, riot_name, riot_tag, role, avatar_color) VALUES (?, ?, ?, ?, ?)").run(name, riot_name || "", riot_tag || "", role || "flex", avatar_color || "#FF4655");
  return NextResponse.json({ id: result.lastInsertRowid });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, name, riot_name, riot_tag, role, avatar_color } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const db = getDb();
  db.prepare("UPDATE players SET name=?, riot_name=?, riot_tag=?, role=?, avatar_color=? WHERE id=?").run(name, riot_name || "", riot_tag || "", role || "flex", avatar_color || "#FF4655", id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const db = getDb();
  db.prepare("DELETE FROM players WHERE id=?").run(id);
  return NextResponse.json({ ok: true });
}
