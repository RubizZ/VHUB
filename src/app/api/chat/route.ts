import { NextRequest, NextResponse } from "next/server";
import { query, dbReady } from "@/lib/db";

export async function GET(req: NextRequest) {
  await dbReady;
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel") || "general";
  const limit = parseInt(searchParams.get("limit") || "50");
  const before = searchParams.get("before");

  const totalResult = await query<{ c: string }>(
    "SELECT COUNT(*) as c FROM messages WHERE channel = $1",
    [channel]
  );
  const total = parseInt(totalResult[0]?.c || "0");

  const params: (string | number)[] = [channel];
  let paramIdx = 2;
  let whereClause = "WHERE m.channel = $1";

  if (before) {
    whereClause += ` AND m.id < $${paramIdx}`;
    params.push(parseInt(before));
    paramIdx++;
  }

  const messages = await query(
    `SELECT m.*, p.name as player_name, p.avatar_color
     FROM messages m JOIN players p ON m.player_id = p.id
     ${whereClause}
     ORDER BY m.created_at DESC
     LIMIT $${paramIdx}`,
    [...params, limit]
  );

  return NextResponse.json({ messages: messages.reverse(), total });
}

export async function POST(req: NextRequest) {
  await dbReady;
  const body = await req.json();
  const { channel, player_id, content } = body;
  if (!player_id || !content)
    return NextResponse.json({ error: "player_id and content required" }, { status: 400 });

  const result = await query(
    "INSERT INTO messages (channel, player_id, content) VALUES ($1, $2, $3) RETURNING id",
    [channel || "general", player_id, content]
  );
  const newId = result[0]?.id;
  const msg = await query(
    "SELECT m.*, p.name as player_name, p.avatar_color FROM messages m JOIN players p ON m.player_id = p.id WHERE m.id = $1",
    [newId]
  );
  return NextResponse.json({ message: msg[0] });
}
