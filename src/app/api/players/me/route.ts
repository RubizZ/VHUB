/* global console */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const playerId = session.user.playerId;
  if (!playerId) return NextResponse.json({ error: "No player linked" }, { status: 404 });

  const player = await db.player.findUnique({
    where: { id: String(playerId) },
    include: { user: { select: { dataConsent: true } } }
  });

  return NextResponse.json({ 
    player: {
      ...player,
      dataConsent: player?.user?.dataConsent || false
    } 
  });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const playerId = session.user.playerId;

  const body = await req.json();
  const { role, avatar_color, dataConsent, name } = body;

  try {
    // Si se pasa el nombre, actualizamos la tabla User
    if (name !== undefined) {
      await db.user.update({
        where: { id: userId },
        data: { name }
      });
    }

    let player = null;

    if (playerId) {
      const existingPlayer = await db.player.findUnique({ where: { id: String(playerId) } });
      if (!existingPlayer) {
        console.error(`[PUT /api/players/me] Player not found with ID: ${playerId} (Type: ${typeof playerId})`);
        return NextResponse.json({ error: "Player not found in database" }, { status: 404 });
      }

      player = await db.player.update({
        where: { id: String(playerId) },
        data: {
          ...(role !== undefined && { role }),
          ...(avatar_color !== undefined && { avatar_color }),
          ...(name !== undefined && { name }),
          user: {
            update: {
              ...(dataConsent !== undefined && { dataConsent })
            }
          }
        },
        include: { user: { select: { dataConsent: true } } }
      });
    }

    return NextResponse.json({ 
      player: player ? {
        ...player,
        dataConsent: player.user?.dataConsent || false
      } : null
    });
  } catch (error) {
    console.error("[PUT /api/players/me] Prisma Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
