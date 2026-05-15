import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const event_id = searchParams.get("event_id");

  if (!event_id) return NextResponse.json({ error: "event_id required" }, { status: 400 });

  const availability = await db.availability.findMany({
    where: { event_id: Number(event_id) },
    include: {
      player: {
        select: {
          name: true,
          avatar_color: true,
          role: true
        }
      }
    }
  });

  return NextResponse.json({ availability });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { event_id, player_id, status, note } = body;

  if (!event_id || !player_id || !status) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // VALIDACIÓN ESTRICTA: ¿Existe este jugador en MI base de datos?
  const playerExists = await db.player.findUnique({
    where: { id: Number(player_id) }
  });

  if (!playerExists) {
    return NextResponse.json({ error: "El jugador no existe en el equipo (Base de Datos)" }, { status: 404 });
  }

  // Validar que el usuario solo pueda marcar su propia disponibilidad (a menos que sea admin)
  const userPlayerId = session.user.playerId;
  const isAdmin = session.user.role === "admin";
  
  if (!isAdmin && Number(player_id) !== Number(userPlayerId)) {
    return NextResponse.json({ error: "No puedes marcar disponibilidad para otro jugador" }, { status: 403 });
  }

  const availability = await db.availability.upsert({
    where: {
      event_id_player_id: {
        event_id: Number(event_id),
        player_id: Number(player_id)
      }
    },
    update: { status, note, updated_at: new Date() },
    create: {
      event_id: Number(event_id),
      player_id: Number(player_id),
      status,
      note
    }
  });

  return NextResponse.json({ availability });
}
