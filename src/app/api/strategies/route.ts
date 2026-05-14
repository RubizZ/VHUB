import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const strategies = db.prepare("SELECT * FROM strategies ORDER BY updated_at DESC").all();
  return NextResponse.json({ strategies });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, map, side, description, canvas_data } = body;
  if (!name || !map) return NextResponse.json({ error: "Name and map required" }, { status: 400 });
  const db = getDb();
  const r = db.prepare("INSERT INTO strategies (name, map, side, description, canvas_data) VALUES (?, ?, ?, ?, ?)").run(name, map, side || "attack", description || "", canvas_data || "{}");
  return NextResponse.json({ id: r.lastInsertRowid });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, name, map, side, description, canvas_data } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const db = getDb();
  db.prepare("UPDATE strategies SET name=?, map=?, side=?, description=?, canvas_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(name, map, side, description, canvas_data || "{}", id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const db = getDb();
  db.prepare("DELETE FROM strategies WHERE id=?").run(id);
  return NextResponse.json({ ok: true });
}
