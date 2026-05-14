import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("event_id");
  const db = getDb();
  if (eventId) {
    const rows = db.prepare("SELECT a.*, p.name as player_name, p.avatar_color FROM availability a JOIN players p ON a.player_id = p.id WHERE a.event_id = ?").all(eventId);
    return NextResponse.json({ availability: rows });
  }
  const rows = db.prepare("SELECT a.*, p.name as player_name FROM availability a JOIN players p ON a.player_id = p.id").all();
  return NextResponse.json({ availability: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { event_id, player_id, status, note } = body;
  if (!event_id || !player_id || !status) return NextResponse.json({ error: "event_id, player_id, status required" }, { status: 400 });
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO availability (event_id, player_id, status, note, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)").run(event_id, player_id, status, note || "");
  return NextResponse.json({ ok: true });
}
