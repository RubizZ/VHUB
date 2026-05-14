import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const events = db.prepare("SELECT * FROM events ORDER BY date ASC, time ASC").all();
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, type, date, time, description, map } = body;
  if (!title || !date || !time) return NextResponse.json({ error: "Title, date and time required" }, { status: 400 });
  const db = getDb();
  const r = db.prepare("INSERT INTO events (title, type, date, time, description, map) VALUES (?, ?, ?, ?, ?, ?)").run(title, type || "match", date, time, description || "", map || "");
  return NextResponse.json({ id: r.lastInsertRowid });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const db = getDb();
  db.prepare("DELETE FROM events WHERE id=?").run(id);
  return NextResponse.json({ ok: true });
}
