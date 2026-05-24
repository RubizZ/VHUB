import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function GET() {
  return NextResponse.json({ error: "Acceso no permitido" }, { status: 403 });
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, conference, team_tag, premier_name } = body;

    if (!name || !conference) {
      return NextResponse.json({ error: "Nombre y región son requeridos" }, { status: 400 });
    }

    // Generate slug automatically based on the team name
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/[^a-z0-9-]/g, ""); // Remove any other non-alphanumeric character (except hyphens)

    if (!slug) {
      return NextResponse.json({ error: "El nombre del equipo debe contener al menos caracteres alfanuméricos para generar un identificador" }, { status: 400 });
    }

    // Check if slug is taken
    const existingTeam = await db.team.findUnique({ where: { slug } });
    if (existingTeam) {
      return NextResponse.json({ error: `El identificador autogenerado "${slug}" ya está en uso. Por favor, elige un nombre de equipo diferente.` }, { status: 400 });
    }

    // Create Team and update User in a transaction to ensure data consistency
    const result = await db.$transaction(async (tx) => {
      // 1. Create the Team
      const team = await tx.team.create({
        data: { name, slug }
      });

      // 1.5 Create PremierTeam if applicable
      if (conference && conference !== "NONE") {
        await tx.premierTeam.create({
          data: {
            teamId: team.id,
            name: premier_name || name,
            tag: team_tag || "TAG",
            conference: conference,
          }
        });
      }

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
