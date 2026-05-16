import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { teamId, slug } = body;

    if (!teamId && !slug) {
      return NextResponse.json({ error: "Se requiere el ID o identificador (slug) del equipo" }, { status: 400 });
    }

    let team = null;
    if (slug) {
      const cleanSlug = slug.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      team = await db.team.findUnique({ where: { slug: cleanSlug } });
    } else if (teamId) {
      team = await db.team.findUnique({ where: { id: teamId } });
    }

    if (!team) {
      return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
    }

    // Check if a request already exists
    const existingRequest = await db.teamJoinRequest.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId: team.id
        }
      }
    });

    if (existingRequest) {
      if (existingRequest.status === "pending") {
        return NextResponse.json({ error: "Ya tienes una solicitud pendiente para este equipo" }, { status: 400 });
      } else if (existingRequest.status === "approved") {
        return NextResponse.json({ error: "Ya eres miembro de este equipo" }, { status: 400 });
      }
      // If rejected, we allow them to apply again by updating the existing request
      const updatedRequest = await db.teamJoinRequest.update({
        where: { id: existingRequest.id },
        data: { status: "pending", created_at: new Date() }
      });
      return NextResponse.json({ success: true, request: updatedRequest });
    }

    // Create the join request
    const joinRequest = await db.teamJoinRequest.create({
      data: {
        userId: session.user.id,
        teamId: team.id,
        status: "pending"
      }
    });

    return NextResponse.json({ success: true, request: joinRequest });
  } catch (error) {
    console.error("[POST /api/teams/join] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
