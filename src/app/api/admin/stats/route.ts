import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [teamsCount, playersCount, usersCount, recentTeams] = await Promise.all([
    db.team.count(),
    db.player.count(),
    db.user.count(),
    db.team.findMany({
      take: 5,
      orderBy: { created_at: "desc" },
      include: {
        _count: { select: { players: true } }
      }
    })
  ]);

  return NextResponse.json({
    stats: {
      teams: teamsCount,
      players: playersCount,
      users: usersCount,
    },
    recentTeams
  });
}
