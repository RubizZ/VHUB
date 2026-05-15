import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "team_admin" && session.user.role !== "super_admin") || !session.user.teamId) {
      return NextResponse.json({ error: "No tienes permisos de administrador" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action } = body; // "approve" or "reject"

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
    }

    const request = await db.teamJoinRequest.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!request) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }

    if (request.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "No tienes permisos sobre esta solicitud" }, { status: 403 });
    }

    if (request.status !== "pending") {
      return NextResponse.json({ error: "La solicitud ya ha sido procesada" }, { status: 400 });
    }

    if (action === "reject") {
      const updatedRequest = await db.teamJoinRequest.update({
        where: { id },
        data: { status: "rejected" }
      });
      return NextResponse.json({ success: true, request: updatedRequest });
    }

    // Action is "approve"
    if (request.user.teamId) {
      // The user already joined another team! We auto-reject this obsolete request.
      await db.teamJoinRequest.update({
        where: { id },
        data: { status: "rejected" }
      });
      return NextResponse.json({ error: "Este usuario ya ha sido aceptado por otro equipo." }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      // 1. Update the request status
      const updatedRequest = await tx.teamJoinRequest.update({
        where: { id },
        data: { status: "approved" }
      });

      // 2. Create the Player profile for the user
      const player = await tx.player.create({
        data: {
          name: request.user.name || "Jugador",
          teamId: request.teamId,
          role: "flex"
        }
      });

      // 3. Link the user to the team and the player
      await tx.user.update({
        where: { id: request.userId },
        data: {
          teamId: request.teamId,
          playerId: player.id,
          role: "member"
        }
      });

      return updatedRequest;
    });

    return NextResponse.json({ success: true, request: result });
  } catch (error) {
    console.error(`[PUT /api/teams/requests/${params.id}] Error:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
