import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [teamsCount, playersCount, usersCount, matchesCount, recentTeams, recentUsers] = await Promise.all([
    db.team.count(),
    db.player.count(),
    db.user.count(),
    db.match.count(),
    db.team.findMany({
      take: 5,
      orderBy: { created_at: "desc" },
      include: {
        _count: { select: { players: true } }
      }
    }),
    db.user.findMany({
      take: 5,
      orderBy: { id: "desc" }, // No created_at in User, using ID as proxy or just showing recent
      select: { id: true, name: true, email: true, role: true, team: { select: { name: true } } }
    })
  ]);

  return NextResponse.json({
    stats: {
      teams: teamsCount,
      players: playersCount,
      users: usersCount,
      matches: matchesCount,
    },
    recentTeams,
    recentUsers
  });
}
