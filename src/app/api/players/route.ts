import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { getRiotClient } from "@/lib/riot/client";

interface RiotError {
  statusCode?: number;
  message?: string;
}

export async function GET() {
  const players = await db.player.findMany({
    orderBy: { id: 'asc' },
    include: { user: { select: { email: true, name: true } } }
  });
  return NextResponse.json({ players });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, riot_name, riot_tag, role, avatar_color } = body;
  
  if (!userId || !riot_name || !riot_tag) {
    return NextResponse.json({ error: "Usuario y Riot ID son obligatorios" }, { status: 400 });
  }

  const client = getRiotClient();
  if (!client) return NextResponse.json({ error: "Riot API no configurada" }, { status: 503 });

  try {
    const account = await client.getAccount(riot_name, riot_tag);
    
    // Obtenemos el nombre del usuario real de la DB para el perfil de jugador
    const selectedUser = await db.user.findUnique({ where: { id: userId } });
    if (!selectedUser) return NextResponse.json({ error: "El usuario seleccionado no existe" }, { status: 404 });

    // Transacción: Crear jugador y vincular al usuario
    const result = await db.$transaction(async (tx) => {
      const player = await tx.player.create({
        data: {
          name: selectedUser.name || "Jugador",
          riot_name: account.gameName,
          riot_tag: account.tagLine,
          puuid: account.puuid,
          role: role || "flex",
          avatar_color: avatar_color || "#FF4655"
        }
      });

      await tx.user.update({
        where: { id: userId },
        data: { playerId: player.id }
      });

      return player;
    });
    
    return NextResponse.json({ id: result.id });
  } catch (err) {
    const riotErr = err as RiotError;
    if (riotErr.statusCode === 404) return NextResponse.json({ error: "Riot ID no encontrado" }, { status: 404 });
    return NextResponse.json({ error: "Error de servidor" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });

  const body = await req.json();
  const { id, riot_name, riot_tag, role, avatar_color } = body;

  const player = await db.player.update({
    where: { id: Number(id) },
    data: {
      riot_name: riot_name || undefined,
      riot_tag: riot_tag || undefined,
      role: role || undefined,
      avatar_color: avatar_color || undefined
    }
  });

  return NextResponse.json({ player });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  
  await db.player.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
