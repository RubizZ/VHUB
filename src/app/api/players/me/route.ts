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

  const playerId = session.user.playerId;
  if (!playerId) return NextResponse.json({ error: "No player linked" }, { status: 404 });

  const body = await req.json();
  const { role, avatar_color, dataConsent } = body;

  try {
    const existingPlayer = await db.player.findUnique({ where: { id: String(playerId) } });
    if (!existingPlayer) {
      console.error(`[PUT /api/players/me] Player not found with ID: ${playerId} (Type: ${typeof playerId})`);
      return NextResponse.json({ error: "Player not found in database" }, { status: 404 });
    }

    const player = await db.player.update({
      where: { id: String(playerId) },
      data: {
        ...(role !== undefined && { role }),
        ...(avatar_color !== undefined && { avatar_color }),
        user: {
          update: {
            ...(dataConsent !== undefined && { dataConsent })
          }
        }
      },
      include: { user: { select: { dataConsent: true } } }
    });

    return NextResponse.json({ 
      player: {
        ...player,
        dataConsent: player.user?.dataConsent || false
      }
    });
  } catch (error) {
    console.error("[PUT /api/players/me] Prisma Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
