import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel") || "general";
  const limit = Number(searchParams.get("limit")) || 50;

  const messages = await db.message.findMany({
    where: { channel },
    take: limit,
    orderBy: { created_at: 'desc' },
    include: {
      player: {
        select: {
          name: true,
          avatar_color: true
        }
      }
    }
  });

  const total = await db.message.count({ where: { channel } });

  // Transform to match UI expectations
  const formatted = messages.reverse().map(m => ({
    id: m.id,
    channel: m.channel,
    player_id: m.player_id,
    player_name: m.player?.name || "Desconocido",
    avatar_color: m.player?.avatar_color || "#999",
    content: m.content,
    created_at: m.created_at
  }));

  return NextResponse.json({ messages: formatted, total });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { channel, player_id, content } = body;

  if (!player_id || !content) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // VALIDACIÓN ESTRICTA: ¿Existe este jugador y es el del usuario?
  const userPlayerId = session.user.playerId;
  if (Number(player_id) !== Number(userPlayerId)) {
    return NextResponse.json({ error: "Intento de suplantación: ID de jugador no válido" }, { status: 403 });
  }

  const playerExists = await db.player.findUnique({ where: { id: Number(player_id) } });
  if (!playerExists) {
    return NextResponse.json({ error: "El perfil de jugador no existe" }, { status: 404 });
  }

  const message = await db.message.create({
    data: {
      channel: channel || "general",
      player_id: Number(player_id),
      content
    }
  });

  return NextResponse.json({ message });
}
