import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

const PRESENCE_TIMEOUT_MS = 15000; // 15 seconds

export async function GET(req: NextRequest) {
  const session = await auth();
  const teamId = (session?.user as any)?.teamId;
  if (!teamId) return NextResponse.json({ error: "No team context" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const strategyId = searchParams.get("strategyId");
  if (!strategyId) return NextResponse.json({ error: "strategyId required" }, { status: 400 });

  // Clean up stale presence records
  const cutoff = new Date(Date.now() - PRESENCE_TIMEOUT_MS);
  await db.strategyPresence.deleteMany({
    where: {
      strategyId: Number(strategyId),
      updatedAt: { lt: cutoff }
    }
  });

  const activeUsers = await db.strategyPresence.findMany({
    where: { strategyId: Number(strategyId) }
  });

  return NextResponse.json({ users: activeUsers });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { strategyId } = body;
  if (!strategyId) return NextResponse.json({ error: "strategyId required" }, { status: 400 });

  const userId = session.user.id!;
  const userName = session.user.name || "Anónimo";

  // Get avatar color from player profile if available
  let userColor = "#E11D48";
  const playerId = (session.user as any).playerId;
  if (playerId) {
    const player = await db.player.findUnique({
      where: { id: String(playerId) },
      select: { avatar_color: true }
    });
    if (player?.avatar_color) userColor = player.avatar_color;
  }

  // Upsert presence record
  await db.strategyPresence.upsert({
    where: {
      strategyId_userId: {
        strategyId: Number(strategyId),
        userId
      }
    },
    update: {
      updatedAt: new Date(),
      userName,
      userColor
    },
    create: {
      strategyId: Number(strategyId),
      userId,
      userName,
      userColor
    }
  });

  // Clean stale records
  const cutoff = new Date(Date.now() - PRESENCE_TIMEOUT_MS);
  await db.strategyPresence.deleteMany({
    where: {
      strategyId: Number(strategyId),
      updatedAt: { lt: cutoff }
    }
  });

  // Return active users
  const activeUsers = await db.strategyPresence.findMany({
    where: { strategyId: Number(strategyId) }
  });

  return NextResponse.json({ users: activeUsers });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const strategyId = searchParams.get("strategyId");
  if (!strategyId) return NextResponse.json({ error: "strategyId required" }, { status: 400 });

  const userId = session.user.id!;

  await db.strategyPresence.deleteMany({
    where: {
      strategyId: Number(strategyId),
      userId
    }
  });

  return NextResponse.json({ ok: true });
}
