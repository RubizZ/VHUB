import { db } from "@/lib/db";
import { auth } from "@/auth";
import { getPremierSeasons } from "@/lib/henrik-api";
import { NextRequest, NextResponse } from "next/server";

async function ensureWeeklyEvents(teamId: string) {
  const now = new Date();

  // 2. Eventos Dinámicos desde API (HenrikDev)
  try {
    const seasons = await getPremierSeasons('eu');
    if (seasons && seasons.length > 0) {
      // Tomamos la temporada activa (la que termina más tarde)
      const activeSeason = [...seasons].sort((a, b) => {
        const endB = b.ends_at ? new Date(b.ends_at).getTime() : 0;
        const endA = a.ends_at ? new Date(a.ends_at).getTime() : 0;
        return endB - endA;
      })[0];

      // Obtenemos la conferencia configurada en el equipo
      const team = await db.team.findUnique({ where: { id: teamId } });
      const targetConference = team?.conference;

      if (!targetConference) {
        console.warn(`[ensureWeeklyEvents] El equipo ${teamId} no tiene una conferencia configurada. Saltando sincronización.`);
        return;
      }
      // Sincronizamos los eventos de la temporada
      for (const evMeta of activeSeason.events || []) {
        // Encontramos el scheduled event que corresponda a este evento y a nuestra conferencia
        const scheduled = (activeSeason.scheduled_events || []).find(s =>
          s.event_id === evMeta.id && s.conference === targetConference
        );

        if (!scheduled || !scheduled.starts_at) continue;
        if (!evMeta.type) continue;

        const evDate = new Date(scheduled.starts_at);
        const dateStr = evDate.toISOString().split('T')[0];
        const timeStr = evDate.getUTCHours().toString().padStart(2, '0') + ":" + evDate.getUTCMinutes().toString().padStart(2, '0');


        let title = "Evento Premier";
        let type = "match";

        if (evMeta.type === 'TOURNAMENT') {
          title = "Playoffs Premier";
        } else if (evMeta.type === 'LEAGUE') {
          title = "Partido de Liga Premier";
        } else if (evMeta.type === 'SCRIM') {
          title = "Entrenamiento (Scrim) Premier";
          type = "practice";
        }

        const mapName = evMeta.map_selection?.maps?.[0]?.name || "Mapa por decidir";

        await db.event.upsert({
          where: {
            teamId_date_time_type: {
              teamId,
              date: dateStr,
              time: timeStr,
              type
            }
          },
          update: {
            title,
            map: mapName,
            premier_week: evMeta.type === 'LEAGUE' ? "Semana Liga" : undefined
          },
          create: {
            teamId,
            title,
            type,
            date: dateStr,
            time: timeStr,
            map: mapName,
            premier_week: evMeta.type === 'LEAGUE' ? "Semana Liga" : undefined,
            status: 'scheduled'
          }
        });
      }
    } else {
      throw new Error("No seasons returned");
    }
  } catch (error) {
    console.error("[ensureWeeklyEvents] Error fetching HenrikDev data:", error);
    throw new Error("No se ha podido obtener el calendario de partidos del premier, inténtalo de nuevo más tarde");
  }
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const teamId = session?.user?.teamId;
  if (!teamId) return NextResponse.json({ error: "No team context" }, { status: 400 });

  // Asegurar que los eventos automáticos existan antes de devolver la lista
  try {
    await ensureWeeklyEvents(teamId);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = await db.event.findMany({
    where: { teamId },
    orderBy: [
      { date: 'asc' },
      { time: 'asc' }
    ]
  });
  return NextResponse.json({ events });
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
  const { title, type, date, time, description, map, premier_week } = body;

  if (type !== "custom") {
    return NextResponse.json({ error: "Solo puedes crear eventos de tipo Custom manualmente" }, { status: 400 });
  }

  if (!title || !date || !time) return NextResponse.json({ error: "Title, date and time required" }, { status: 400 });

  const event = await db.event.create({
    data: {
      teamId,
      title,
      type: type || "match",
      date,
      time,
      description: description || "",
      map: map || "",
      premier_week: premier_week || null
    }
  });

  return NextResponse.json({ id: event.id });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  const teamId = session?.user?.teamId;

  const body = await req.json();
  const { id, status, match_id } = body;

  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  // Validar pertenencia al equipo
  const existingEvent = await db.event.findUnique({ where: { id: Number(id) } });
  if (!existingEvent || existingEvent.teamId !== teamId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await db.event.update({
    where: { id: Number(id) },
    data: {
      status: status || undefined,
      match_id: match_id || undefined
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  const role = session?.user?.role;
  const teamId = session?.user?.teamId;

  if (role !== "team_admin" && role !== "super_admin") return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const existingEvent = await db.event.findUnique({ where: { id: Number(id) } });
  if (!existingEvent || existingEvent.teamId !== teamId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await db.event.delete({
    where: { id: Number(id) }
  });

  return NextResponse.json({ ok: true });
}
