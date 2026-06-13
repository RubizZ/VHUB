 
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { getRiotClient } from "@/lib/external/riot/client";

interface RiotError {
  statusCode?: number;
  message?: string;
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.teamId) return NextResponse.json({ error: "No team context" }, { status: 400 });

  const players = await db.player.findMany({
    where: { teamId: session.user.teamId },
    orderBy: { id: 'asc' },
    include: { user: { select: { email: true, name: true, dataConsent: true, lastActiveAt: true } } }
  });
  return NextResponse.json({ players });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = session?.user?.role;
  const teamId = session?.user?.teamId;

  if (role !== "team_admin" && role !== "super_admin") {
    return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
  }

  if (!teamId) return NextResponse.json({ error: "No team context" }, { status: 400 });

  const body = await req.json();
  const { email, role: playerRole, avatar_color } = body;
  
  if (!email) {
    return NextResponse.json({ error: "El email es obligatorio" }, { status: 400 });
  }

  try {
    const selectedUser = await db.user.findUnique({ where: { email } });
    if (!selectedUser) return NextResponse.json({ error: "No existe ningún usuario con ese email" }, { status: 404 });

    if (selectedUser.teamId) {
      if (selectedUser.teamId === teamId) {
        return NextResponse.json({ error: "El usuario ya pertenece a este equipo" }, { status: 400 });
      }
      return NextResponse.json({ error: "El usuario ya pertenece a otro equipo" }, { status: 403 });
    }

    const result = await db.$transaction(async (tx) => {
      const player = await tx.player.create({
        data: {
          teamId: teamId,
          name: selectedUser.name || "Jugador",
          role: playerRole || "flex",
          avatar_color: avatar_color || "#E11D48"
        }
      });

      await tx.user.update({
        where: { id: selectedUser.id },
        data: { playerId: player.id, teamId: teamId, role: "member" }
      });

      // Accept invitation to this team if exists
      await tx.teamJoinRequest.updateMany({
        where: { userId: selectedUser.id, teamId: teamId, status: "pending" },
        data: { status: "approved" }
      });

      // Reject invitations to other teams
      await tx.teamJoinRequest.updateMany({
        where: { userId: selectedUser.id, teamId: { not: teamId }, status: "pending" },
        data: { status: "rejected" }
      });

      return player;
    });
    
    return NextResponse.json({ id: result.id });
  } catch (err) {
    return NextResponse.json({ error: "Error de servidor" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  const role = session?.user?.role;
  const teamId = session?.user?.teamId;

  if (role !== "team_admin" && role !== "super_admin") return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });

  const body = await req.json();
  const { id, role: playerRole, avatar_color } = body;

  // Validar que el jugador pertenezca al equipo del admin
  const existingPlayer = await db.player.findUnique({ where: { id: String(id) } });
  if (!existingPlayer || existingPlayer.teamId !== teamId) {
    return NextResponse.json({ error: "No autorizado o jugador no encontrado" }, { status: 403 });
  }

  const player = await db.player.update({
    where: { id: String(id) },
    data: {
      role: playerRole || undefined,
      avatar_color: avatar_color || undefined
    }
  });

  return NextResponse.json({ player });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  const role = session?.user?.role;
  const teamId = session?.user?.teamId;

  if (role !== "team_admin" && role !== "super_admin") return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  
  const existingPlayer = await db.player.findUnique({ where: { id: String(id) } });
  if (!existingPlayer || existingPlayer.teamId !== teamId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await db.player.delete({ where: { id: String(id) } });
  return NextResponse.json({ ok: true });
}
