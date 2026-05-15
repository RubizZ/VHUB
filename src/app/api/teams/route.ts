import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const teams = await db.team.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        logo_url: true
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ teams });
  } catch (error) {
    console.error("[GET /api/teams] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, slug, conference } = body;

    if (!name || !slug || !conference) {
      return NextResponse.json({ error: "Nombre, slug y región son requeridos" }, { status: 400 });
    }

    // Check if slug is taken
    const existingTeam = await db.team.findUnique({ where: { slug } });
    if (existingTeam) {
      return NextResponse.json({ error: "El slug (identificador) ya está en uso" }, { status: 400 });
    }

    // Create Team and update User in a transaction to ensure data consistency
    const result = await db.$transaction(async (tx) => {
      // 1. Create the Team
      const team = await tx.team.create({
        data: { name, slug, conference }
      });

      // 2. Create the Player profile for the founder
      const player = await tx.player.create({
        data: {
          name: session.user.name || "Jugador",
          teamId: team.id,
          role: "flex"
        }
      });

      // 3. Update the User to be the team_admin and link the player
      const user = await tx.user.update({
        where: { id: session.user.id },
        data: {
          teamId: team.id,
          playerId: player.id,
          role: "team_admin"
        }
      });

      return { team, user };
    });

    return NextResponse.json({ success: true, team: result.team });
  } catch (error) {
    console.error("[POST /api/teams] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
