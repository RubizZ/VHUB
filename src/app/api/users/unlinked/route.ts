import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  const role = session?.user?.role;
  const teamId = session?.user?.teamId;

  if (role !== "team_admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!teamId) return NextResponse.json({ error: "No team context" }, { status: 400 });

  // Buscamos usuarios que pertenezcan al equipo y NO tengan un playerId vinculado
  const users = await db.user.findMany({
    where: {
      teamId: teamId,
      playerId: null
    },
    select: {
      id: true,
      name: true,
      email: true
    }
  });

  return NextResponse.json({ users });
}
