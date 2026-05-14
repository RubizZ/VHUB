import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("event_id");

  if (eventId) {
    const rows = await db.availability.findMany({
      where: { event_id: Number(eventId) },
      include: {
        player: {
          select: { name: true, avatar_color: true }
        }
      }
    });
    
    // Transform to match previous API format
    const availability = rows.map(r => ({
      ...r,
      player_name: r.player.name,
      avatar_color: r.player.avatar_color
    }));
    
    return NextResponse.json({ availability });
  }

  const rows = await db.availability.findMany({
    include: {
      player: { select: { name: true } }
    }
  });

  const availability = rows.map(r => ({
    ...r,
    player_name: r.player.name
  }));

  return NextResponse.json({ availability });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { event_id, player_id, status } = body;
  
  if (!event_id || !player_id || !status)
    return NextResponse.json({ error: "event_id, player_id, status required" }, { status: 400 });

  await db.availability.upsert({
    where: {
      event_id_player_id: {
        event_id: Number(event_id),
        player_id: Number(player_id)
      }
    },
    update: { status, updated_at: new Date() },
    create: {
      event_id: Number(event_id),
      player_id: Number(player_id),
      status,
      updated_at: new Date()
    }
  });

  return NextResponse.json({ ok: true });
}
