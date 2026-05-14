import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel") || "general";
  const limit = parseInt(searchParams.get("limit") || "50");
  const before = searchParams.get("before");
  const db = getDb();

  const total = (db.prepare("SELECT COUNT(*) as c FROM messages WHERE channel = ?").get(channel) as { c: number }).c;

  let query = "SELECT m.*, p.name as player_name, p.avatar_color FROM messages m JOIN players p ON m.player_id = p.id WHERE m.channel = ?";
  const params: (string | number)[] = [channel];
  if (before) {
    query += " AND m.id < ?";
    params.push(parseInt(before));
  }
  query += " ORDER BY m.created_at DESC LIMIT ?";
  params.push(limit);

  const messages = db.prepare(query).all(...params);
  return NextResponse.json({ messages: messages.reverse(), total });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { channel, player_id, content } = body;
  if (!player_id || !content) return NextResponse.json({ error: "player_id and content required" }, { status: 400 });
  const db = getDb();
  const r = db.prepare("INSERT INTO messages (channel, player_id, content) VALUES (?, ?, ?)").run(channel || "general", player_id, content);
  const msg = db.prepare("SELECT m.*, p.name as player_name, p.avatar_color FROM messages m JOIN players p ON m.player_id = p.id WHERE m.id = ?").get(r.lastInsertRowid);
  return NextResponse.json({ message: msg });
}
