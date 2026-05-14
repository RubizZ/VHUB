import { NextRequest, NextResponse } from "next/server";
import { query, execute, dbReady } from "@/lib/db";

export async function GET(req: NextRequest) {
  await dbReady;
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("event_id");
  if (eventId) {
    const rows = await query(
      "SELECT a.*, p.name as player_name, p.avatar_color FROM availability a JOIN players p ON a.player_id = p.id WHERE a.event_id = $1",
      [eventId]
    );
    return NextResponse.json({ availability: rows });
  }
  const rows = await query(
    "SELECT a.*, p.name as player_name FROM availability a JOIN players p ON a.player_id = p.id"
  );
  return NextResponse.json({ availability: rows });
}

export async function POST(req: NextRequest) {
  await dbReady;
  const body = await req.json();
  const { event_id, player_id, status } = body;
  if (!event_id || !player_id || !status)
    return NextResponse.json({ error: "event_id, player_id, status required" }, { status: 400 });
  await execute(
    `INSERT INTO availability (event_id, player_id, status, updated_at) VALUES ($1, $2, $3, NOW())
     ON CONFLICT (event_id, player_id) DO UPDATE SET status = $3, updated_at = NOW()`,
    [event_id, player_id, status]
  );
  return NextResponse.json({ ok: true });
}
