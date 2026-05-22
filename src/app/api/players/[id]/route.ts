import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing player ID" }, { status: 400 });

  const teamId = session.user.teamId;

  const player = await db.player.findUnique({
    where: { id },
    include: { 
      team: { select: { name: true, tag: true } },
      user: { select: { email: true, lastActiveAt: true } } 
    }
  });

  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // Only allow viewing players in the same team
  if (player.teamId !== teamId) {
    return NextResponse.json({ error: "Unauthorized access to player" }, { status: 403 });
  }

  return NextResponse.json({ player });
}
