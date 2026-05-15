import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const playerId = session.user.playerId;
  if (!playerId) return NextResponse.json({ error: "No player linked" }, { status: 404 });

  const player = await db.player.findUnique({
    where: { id: Number(playerId) }
  });

  return NextResponse.json({ player });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const playerId = session.user.playerId;
  if (!playerId) return NextResponse.json({ error: "No player linked" }, { status: 404 });

  const body = await req.json();
  const { role, avatar_color } = body;

  const player = await db.player.update({
    where: { id: Number(playerId) },
    data: {
      role: role || undefined,
      avatar_color: avatar_color || undefined
    }
  });

  return NextResponse.json({ player });
}
