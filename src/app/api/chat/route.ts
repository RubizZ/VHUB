import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel") || "general";
  const limit = parseInt(searchParams.get("limit") || "50");
  const before = searchParams.get("before");

  const total = await db.message.count({
    where: { channel }
  });

  const messagesRaw = await db.message.findMany({
    where: {
      channel,
      id: before ? { lt: Number(before) } : undefined
    },
    take: limit,
    orderBy: { id: 'desc' },
    include: {
      player: { select: { name: true, avatar_color: true } }
    }
  });

  const messages = messagesRaw.map(m => ({
    ...m,
    player_name: m.player.name,
    avatar_color: m.player.avatar_color
  })).reverse();

  return NextResponse.json({ messages, total });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { channel, player_id, content } = body;
  
  if (!player_id || !content)
    return NextResponse.json({ error: "player_id and content required" }, { status: 400 });

  const newMessage = await db.message.create({
    data: {
      channel: channel || "general",
      player_id: Number(player_id),
      content
    },
    include: {
      player: { select: { name: true, avatar_color: true } }
    }
  });

  const message = {
    ...newMessage,
    player_name: newMessage.player.name,
    avatar_color: newMessage.player.avatar_color
  };

  return NextResponse.json({ message });
}
