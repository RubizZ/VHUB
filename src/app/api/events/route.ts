import { db } from "@/lib/db";
import { auth } from "@/auth";
import { getPremierSeasons } from "@/lib/henrik-api";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
const SYNC_CACHE = new Map<string, number>();
const SYNC_COOLDOWN = 30 * 60 * 1000; // 30 minutos

async function ensureWeeklyEvents(teamId: string) {
  const now = new Date();
  console.log(`[ensureWeeklyEvents] Iniciando para equipo: ${teamId}`);

  try {
    let seasons = await getPremierSeasons('eu');
    
    if (!seasons || seasons.length === 0) {
      console.warn("[ensureWeeklyEvents] API de temporadas vacía, buscando en DB...");
      const dbSeasons = await db.season.findMany();
      if (dbSeasons.length === 0) {
        throw new Error("No hay temporadas disponibles ni en API ni en DB.");
      }
      seasons = dbSeasons.map(s => ({
        id: s.id,
        starts_at: s.starts_at?.toISOString() || null,
        ends_at: s.ends_at?.toISOString() || null,
        events: []
      })) as any;
    }

    // 1. Sincronizar temporadas en DB
    for (const s of seasons) {
      const starts = s.starts_at ? new Date(s.starts_at) : null;
      const ends = s.ends_at ? new Date(s.ends_at) : null;
      
      await db.season.upsert({
        where: { id: s.id },
        update: {
          name: (s as any).name || `Temporada ${s.id.substring(0, 8)}`,
          starts_at: starts && !isNaN(starts.getTime()) ? starts : null,
          ends_at: ends && !isNaN(ends.getTime()) ? ends : null
        },
        create: {
          id: s.id,
          name: (s as any).name || `Temporada ${s.id.substring(0, 8)}`,
          starts_at: starts && !isNaN(starts.getTime()) ? starts : null,
          ends_at: ends && !isNaN(ends.getTime()) ? ends : null
        }
      });
    }

    // 2. Identificar temporada activa (la que cubre el día de hoy)
    let activeSeason = seasons.find(s => {
      const start = s.starts_at ? new Date(s.starts_at) : null;
      const end = s.ends_at ? new Date(s.ends_at) : null;
      return start && end && now >= start && now <= end;
    });

    if (!activeSeason) {
      activeSeason = [...seasons].sort((a, b) => {
        const endB = b.ends_at ? new Date(b.ends_at).getTime() : 0;
        const endA = a.ends_at ? new Date(a.ends_at).getTime() : 0;
        return endB - endA;
      })[0];
    }

    console.log(`[ensureWeeklyEvents] Temporada seleccionada: ${activeSeason?.id}`);

    const team = await db.team.findUnique({ where: { id: teamId } });
    if (!team) {
      console.error(`[ensureWeeklyEvents] ERROR: Equipo ${teamId} NO encontrado en DB.`);
      return;
    }

    if (!team.conference) {
      console.warn(`[ensureWeeklyEvents] Equipo ${teamId} sin conferencia.`);
      // No salimos, intentamos generar igual con datos genéricos
    }

    // 3. NO BORRAMOS EVENTOS EXISTENTES (Para no perder disponibilidad guardada)
    // Solo permitimos que createMany añada los que falten con skipDuplicates.
    /*
    const deleted = await db.event.deleteMany({
      where: {
        teamId,
        type: { in: ['match', 'practice', 'playoffs'] },
        status: 'scheduled'
      }
    });
    console.log(`[ensureWeeklyEvents] Eventos antiguos borrados: ${deleted.count}`);
    */

    // 4. Configurar fechas del bucle
    const seasonStart = (activeSeason.starts_at && !isNaN(new Date(activeSeason.starts_at).getTime())) ? new Date(activeSeason.starts_at) : new Date(now.getFullYear(), now.getMonth(), 1);
    // Forzar seasonEnd a ser válido (mínimo 60 días desde hoy si no hay dato)
    const seasonEnd = (activeSeason.ends_at && !isNaN(new Date(activeSeason.ends_at).getTime()) && new Date(activeSeason.ends_at).getFullYear() > 2000) 
      ? new Date(activeSeason.ends_at) 
      : new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    
    const tournamentEvent = activeSeason.events?.find(e => e.type === 'TOURNAMENT');

    // FALLBACK INTELIGENTE: Si la API da fechas basura (año 0001), 
    // calculamos el último domingo de la temporada como día de Playoffs.
    let tournamentDateStr = (tournamentEvent?.starts_at && new Date(tournamentEvent.starts_at).getFullYear() > 2000)
      ? tournamentEvent.starts_at.split('T')[0]
      : null;

    if (!tournamentDateStr) {
      // Buscar el último domingo antes o en el seasonEnd
      const lastSunday = new Date(seasonEnd);
      while (lastSunday.getDay() !== 0) {
        lastSunday.setDate(lastSunday.getDate() - 1);
      }
      tournamentDateStr = lastSunday.toISOString().split('T')[0];
    }

    let tempDate = new Date(seasonStart);
    tempDate.setUTCHours(0, 0, 0, 0);

    const minStart = new Date(now);
    minStart.setUTCHours(0, 0, 0, 0);
    minStart.setDate(minStart.getDate() - 21);
    if (tempDate < minStart) tempDate = minStart;

    // El límite de generación es el día del torneo (inclusive)
    const limitDate = new Date(tournamentDateStr);
    limitDate.setUTCHours(0, 0, 0, 0);
    
    console.log(`[ensureWeeklyEvents] Generando hasta Playoffs: ${tournamentDateStr}`);
    console.log(`[ensureWeeklyEvents] Generando desde ${tempDate.toISOString()} hasta ${limitDate.toISOString()}`);

    const eventsToCreate: any[] = [];

    while (tempDate <= limitDate) {
      const dateStr = tempDate.toISOString().split('T')[0];
      const day = tempDate.getDay(); 
      
      let evConfig: any = null;

      // Prioridad 1: Playoffs (Si es el día del torneo o el último día de la generación si hay torneo planeado)
      if (dateStr === tournamentDateStr || (tempDate.getTime() === limitDate.getTime() && tournamentEvent)) {
        evConfig = { title: "Playoffs Premier", type: "playoffs", time: "17:00", description: "Inscripción (17:00 - 17:15) y Brackets" };
      } else if (day === 3 || day === 5) {
        evConfig = { title: "Práctica de Equipo", type: "practice", time: "17:00" };
      } else if (day === 4 || day === 6 || day === 0) {
        evConfig = { title: "Partido Premier", type: "match", time: "17:00" };
      }

      if (evConfig) {
        const evMeta = activeSeason.events?.find(m => {
          if (!m.starts_at || !m.ends_at) return false;
          const sDate = m.starts_at.split('T')[0];
          const eDate = m.ends_at.split('T')[0];
          return dateStr >= sDate && dateStr <= eDate;
        });

        let mapName = "Por decidir";
        let premierWeek = undefined;

        if (evMeta) {
          if (evMeta.map_selection?.type === 'PICKBAN') {
            mapName = "Pick & Ban";
          } else {
            mapName = evMeta.map_selection?.maps?.[0]?.name || "Por decidir";
          }
          if (evMeta.type === 'LEAGUE') premierWeek = "Semana de Liga";
        }

        eventsToCreate.push({
          teamId,
          title: evConfig.title,
          type: evConfig.type,
          date: dateStr,
          time: evConfig.time,
          description: evConfig.description || "",
          map: mapName,
          premier_week: premierWeek,
          premier_season_id: activeSeason.id,
          status: 'scheduled'
        });

        // Si es el torneo, terminamos
        if (evConfig.type === 'playoffs') break;
      }

      tempDate.setDate(tempDate.getDate() + 1);
    }

    if (eventsToCreate.length > 0) {
      console.log(`[ensureWeeklyEvents] Insertando ${eventsToCreate.length} nuevos eventos...`);
      await db.event.createMany({
        data: eventsToCreate,
        skipDuplicates: true
      });
      console.log("[ensureWeeklyEvents] ✅ Completado.");
    }

  } catch (error) {
    console.error("[ensureWeeklyEvents] ❌ ERROR CRÍTICO:", error);
    throw error;
  }
}

export async function GET(req: NextRequest) {
  console.log(">>> [API EVENTS] PETICION RECIBIDA <<<");
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const teamId = session?.user?.teamId;
    if (!teamId) return NextResponse.json({ error: "No team context" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const seasonParam = searchParams.get("season");

    // 1. Asegurar generación (con caché de 30 min para no saturar)
    const forceSync = searchParams.get("sync") === "true";
    const lastSync = SYNC_CACHE.get(teamId) || 0;
    const now = Date.now();

    if (forceSync || (now - lastSync > SYNC_COOLDOWN)) {
      console.log(`[GET /api/events] Ejecutando sincronización para equipo ${teamId}...`);
      await ensureWeeklyEvents(teamId);
      SYNC_CACHE.set(teamId, now);
    } else {
      console.log(`[GET /api/events] Saltando sincronización para ${teamId} (última hace ${Math.round((now - lastSync) / 1000 / 60)} min)`);
    }

    // 2. Buscar eventos (si seasonParam es null o "", traemos todos los del equipo)
    const events = await db.event.findMany({
      where: {
        teamId: teamId,
        ...(seasonParam ? { premier_season_id: seasonParam } : {})
      },
      include: {
        availability: {
          include: {
            player: {
              select: {
                id: true,
                name: true,
                avatar_color: true
              }
            }
          }
        }
      },
      orderBy: [
        { date: 'asc' },
        { time: 'asc' }
      ]
    });

    // 3. Obtener IDs de temporadas presentes en los eventos para el filtro del frontend
    const seasonsData = await db.event.findMany({
      where: { teamId, premier_season_id: { not: null } },
      select: { premier_season_id: true },
      distinct: ['premier_season_id']
    }).catch(() => []);

    const seasons = seasonsData.map(s => s.premier_season_id).filter(Boolean) as string[];

    // 4. Identificar temporada activa por fecha actual
    const nowTime = new Date();
    const activeSeason = await db.season.findFirst({
      where: {
        starts_at: { lte: nowTime },
        ends_at: { gte: nowTime }
      },
      select: { id: true }
    });

    console.log(`[GET /api/events] Devolviendo ${events.length} eventos para equipo ${teamId}`);

    return NextResponse.json({ 
      events, 
      seasons, 
      activeSeasonId: activeSeason?.id || (seasons.length > 0 ? seasons[0] : "") 
    });
  } catch (error: any) {
    console.error("[GET /api/events] ❌ CRITICAL ERROR:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
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

  if (existingEvent.type !== "custom") {
    return NextResponse.json({ error: "Solo puedes borrar eventos personalizados (tipo custom)" }, { status: 400 });
  }

  await db.event.delete({
    where: { id: Number(id) }
  });

  return NextResponse.json({ ok: true });
}
