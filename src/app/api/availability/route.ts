import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  const teamId = session?.user?.teamId;
  if (!teamId) return NextResponse.json({ error: "No team context" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const event_id = searchParams.get("event_id");

  if (!event_id) return NextResponse.json({ error: "event_id required" }, { status: 400 });

  const event = await db.event.findUnique({ where: { id: Number(event_id) } });
  const userRole = (session?.user as any)?.role;
  const isSuperAdmin = userRole === "super_admin";

  if (!event || (event.teamId !== teamId && !isSuperAdmin)) {
    console.log(`[API AVAILABILITY] GET 403 - TeamMismatch. SessionTeam: ${teamId}, EventTeam: ${event?.teamId}, Role: ${userRole}`);
    return NextResponse.json({ error: "Event not found or not authorized" }, { status: 403 });
  }

  const availability = await db.availability.findMany({
    where: { event_id: Number(event_id) },
    include: {
      player: {
        select: {
          name: true,
          riot_name: true,
          riot_tag: true,
          avatar_color: true,
          role: true
        }
      }
    }
  });

  return NextResponse.json({ availability });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const teamId = session?.user?.teamId;
  const role = session?.user?.role;
  
  if (!session?.user || !teamId) {
    console.warn(`[API AVAILABILITY] POST 401 - Unauthorized. Session: ${!!session}, TeamId: ${teamId}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { event_id, player_id, status, note } = body;

  if (!event_id || !player_id || !status) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // VALIDACIÓN DE EQUIPO: El jugador debe ser del equipo del usuario
  const player = await db.player.findUnique({
    where: { id: String(player_id) }
  });

  if (!player) {
    return NextResponse.json({ error: "El jugador no existe" }, { status: 404 });
  }

  // Si el jugador no tiene equipo asignado (por algún error previo), lo sincronizamos con el del usuario
  if (!player.teamId) {
    await db.player.update({
      where: { id: player.id },
      data: { teamId: teamId }
    });
  } else if (player.teamId !== teamId) {
    console.warn(`[API AVAILABILITY] POST 403 - PlayerTeamMismatch. Player: ${player.id}, PlayerTeam: ${player.teamId}, SessionTeam: ${teamId}`);
    return NextResponse.json({ error: "El jugador no pertenece a tu equipo" }, { status: 403 });
  }

  // VALIDACIÓN DE EQUIPO: El evento debe ser del equipo del usuario
  const event = await db.event.findUnique({
    where: { id: Number(event_id) }
  });

  if (!event || (event.teamId !== teamId && role !== "super_admin")) {
    console.warn(`[API AVAILABILITY] POST 403 - EventTeamMismatch. Event: ${event?.id}, EventTeam: ${event?.teamId}, SessionTeam: ${teamId}, Role: ${role}`);
    return NextResponse.json({ error: "El evento no pertenece a tu equipo" }, { status: 403 });
  }

  // Validar permisos de edición (dueño o admin)
  const userPlayerId = session.user.playerId;
  const isPrivileged = role === "team_admin" || role === "super_admin";
  
  if (!isPrivileged && String(player_id) !== String(userPlayerId)) {
    console.log(`[API AVAILABILITY] POST 403 - No Privilegiado y ID Mismatch. Solicitado: ${player_id}, Sesion: ${userPlayerId}`);
    return NextResponse.json({ error: "No puedes marcar disponibilidad para otro jugador" }, { status: 403 });
  }

  const availability = await db.availability.upsert({
    where: {
      event_id_player_id: {
        event_id: Number(event_id),
        player_id: String(player_id)
      }
    },
    update: { status, note, updated_at: new Date() },
    create: {
      event_id: Number(event_id),
      player_id: String(player_id),
      status,
      note
    }
  });

  return NextResponse.json({ availability });
}
