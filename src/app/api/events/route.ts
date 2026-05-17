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

    // Pre-procesar scheduled_events filtrados por conferencia del equipo
    const teamConference = team.conference?.toLowerCase() || '';
    const conferenceSchedules = activeSeason.scheduled_events?.filter(
      (se: any) => se.conference?.toLowerCase() === teamConference
    ) || [];

    console.log(`[ensureWeeklyEvents] Conferencia del equipo: ${teamConference}, scheduled_events encontrados: ${conferenceSchedules.length}`);
    
    // Cache de mapas para evitar queries en el bucle
    const allMaps = await db.map.findMany();
    const mapNameToId = new Map(allMaps.map(m => [m.name.toLowerCase(), m.id]));

    while (tempDate <= limitDate) {
      const dateStr = tempDate.toISOString().split('T')[0];
      const day = tempDate.getDay();

      let matchingSchedule = conferenceSchedules.find((se: any) => {
        if (!se.starts_at || !se.ends_at) return false;
        const sDate = se.starts_at.split('T')[0];
        const eDate = se.ends_at.split('T')[0];
        return dateStr >= sDate && dateStr <= eDate;
      });

      let evMeta = null;
      if (matchingSchedule?.event_id) {
        evMeta = activeSeason.events?.find((e: any) => e.id === matchingSchedule.event_id);
      }

      if (!evMeta) {
        evMeta = activeSeason.events?.find((m: any) => {
          if (!m.starts_at || !m.ends_at) return false;
          const sDate = m.starts_at.split('T')[0];
          const eDate = m.ends_at.split('T')[0];
          return dateStr >= sDate && dateStr <= eDate;
        });
      }

      const isTournamentDay = dateStr === tournamentDateStr || (tempDate.getTime() === limitDate.getTime() && tournamentEvent);
      
      if (!isTournamentDay && !matchingSchedule && !evMeta) {
        tempDate.setDate(tempDate.getDate() + 1);
        continue;
      }

      let evConfig: any = null;

      // Prioridad 1: Playoffs (Si es el día del torneo o el último día de la generación si hay torneo planeado)
      if (isTournamentDay) {
        evConfig = { title: "Playoffs Premier", type: "playoffs", time: "17:00" };
      } else if (day === 3 || day === 5) {
        evConfig = { title: "Práctica de Equipo", type: "practice", time: "17:00" };
      } else if (day === 4 || day === 6 || day === 0) {
        evConfig = { title: "Partido Premier", type: "match", time: "17:00" };
      }

      if (evConfig) {
        // Estrategia de resolución de mapa:
        // 1. Buscar scheduled_event de la conferencia del equipo que cubra esta fecha
        // 2. Usar su event_id para encontrar el evento padre con map_selection
        // 3. Fallback: buscar directamente en events por rango de fecha

        let mapId: string | null = null;
        let mapLabel = "Por decidir";
        let premierWeek = undefined;

        if (evConfig.type === 'playoffs') {
          mapId = null;
          mapLabel = "Pick & Ban";
        } else if (evMeta) {
          const apiMapName = evMeta.map_selection?.maps?.[0]?.name?.toLowerCase() || "";
          mapId = apiMapName ? (mapNameToId.get(apiMapName) || null) : null;
          
          if (evMeta.map_selection?.type === 'PICKBAN') {
            mapLabel = "Pick & Ban";
          } else {
            mapLabel = evMeta.map_selection?.maps?.[0]?.name || "Por decidir";
          }
          if (evMeta.type === 'LEAGUE') premierWeek = "Semana de Liga";
        }

        // Extraer end_date y end_time de la ventana del scheduled_event o del evento padre
        let endDate: string | undefined = undefined;
        let endTime: string | undefined = undefined;
        const endSource = matchingSchedule?.ends_at || evMeta?.ends_at;
        if (endSource) {
          const endDt = new Date(endSource);
          if (!isNaN(endDt.getTime()) && endDt.getFullYear() > 2000) {
            endDate = endDt.toISOString().split('T')[0];
            endTime = endDt.getUTCHours().toString().padStart(2, '0') + ':' + endDt.getUTCMinutes().toString().padStart(2, '0');
          }
        }

        // Generar un título dinámico no duplicado que aporte información de mapa/fase
        let dynamicTitle = evConfig.title;
        if (evConfig.type === 'playoffs') {
          dynamicTitle = "Playoffs: Pick & Ban";
        } else if (evConfig.type === 'practice') {
          dynamicTitle = mapLabel !== "Por decidir" && mapLabel !== "Pick & Ban" ? `Entrenamiento: ${mapLabel}` : "Sesión de Entrenamiento";
        } else if (evConfig.type === 'match') {
          dynamicTitle = mapLabel !== "Por decidir" && mapLabel !== "Pick & Ban" ? `Jornada de Liga: ${mapLabel}` : "Jornada de Liga Premier";
        }

        eventsToCreate.push({
          teamId,
          title: dynamicTitle,
          type: evConfig.type,
          date: dateStr,
          time: evConfig.time,
          end_date: endDate || null,
          end_time: endTime || null,
          description: evConfig.description || (mapLabel !== "Por decidir" && !mapId ? mapLabel : ""),
          map: mapId,
          premier_week: premierWeek || null,
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

      // Actualizar mapas y títulos en eventos existentes que todavía tienen "Por decidir"
      // (para prácticas y partidos, no playoffs)
      for (const ev of eventsToCreate) {
        if (ev.map && ev.map !== "Por decidir" && ev.map !== "Pick & Ban" && ev.type !== "playoffs") {
          await db.event.updateMany({
            where: {
              teamId,
              date: ev.date,
              time: ev.time,
              type: ev.type,
              OR: [
                { map: "" },
                { map: "Por decidir" },
                { map: "Pick & Ban" }
              ]
            },
            data: { 
              map: ev.map,
              title: ev.title
            }
          });
        }
        // Actualizar end_date/end_time en eventos existentes que no los tengan
        if (ev.end_date && ev.end_time) {
          await db.event.updateMany({
            where: {
              teamId,
              date: ev.date,
              time: ev.time,
              type: ev.type,
              end_date: null
            },
            data: { end_date: ev.end_date, end_time: ev.end_time }
          });
        }
      }

      // Limpiar descripciones hardcodeadas de playoffs
      await db.event.updateMany({
        where: {
          teamId,
          type: 'playoffs',
          description: { not: "" }
        },
        data: { description: "" }
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

    // 2b. Obtener partidos vinculados a estos eventos (via Match.event_id)
    const eventIds = events.map(e => e.id);
    const linkedMatches = eventIds.length > 0 ? await db.match.findMany({
      where: {
        event_id: { in: eventIds }
      },
      select: {
        id: true,
        event_id: true,
        riot_match_id: true,
        map_name: true,
        game_start: true,
        game_length_ms: true,
        team_blue_score: true,
        team_red_score: true,
        team_blue_won: true,
        queue_id: true,
        player_stats: {
          select: {
            player_id: true,
            team_id: true,
            player: { select: { teamId: true } }
          },
          where: { player_id: { not: null } }
        }
      },
      orderBy: { game_start: 'asc' }
    }) : [];

    // Enriquecer partidos con our_team_side
    const processedLinkedMatches = (linkedMatches as any[]).map(m => {
      const ourSide = m.player_stats.find((s: any) => s.player?.teamId === teamId)?.team_id || "Blue";
      return { ...m, our_team_side: ourSide };
    });

    // Agrupar partidos por event_id
    const matchesByEvent: Record<number, any[]> = {};
    for (const m of processedLinkedMatches) {
      if (m.event_id) {
        if (!matchesByEvent[m.event_id]) matchesByEvent[m.event_id] = [];
        matchesByEvent[m.event_id].push(m);
      }
    }

    // 2c. Auto-cancelar eventos de tipo "match" si ya hay 2+ partidos jugados esa semana
    // Calcular semana ISO para cada evento
    const getISOWeek = (dateStr: string) => {
      const d = new Date(dateStr + 'T00:00:00Z');
      const dayNum = d.getUTCDay() || 7; // Make Sunday = 7
      d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Set to nearest Thursday
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      return `${d.getUTCFullYear()}-W${weekNo}`;
    };

    // Contar partidos jugados por semana (solo para eventos tipo "match" con status "completed")
    const matchesPlayedPerWeek: Record<string, number> = {};
    for (const ev of events) {
      if (ev.type === 'match' && ev.status === 'completed') {
        const week = getISOWeek(ev.date);
        const matchCount = matchesByEvent[ev.id]?.length || 0;
        matchesPlayedPerWeek[week] = (matchesPlayedPerWeek[week] || 0) + Math.max(matchCount, 1);
      }
    }

    // Cancelar eventos de tipo "match" programados si ya se jugaron 2+ esa semana
    const eventIdsToCancel: number[] = [];
    for (const ev of events) {
      if (ev.type === 'match' && ev.status === 'scheduled') {
        const week = getISOWeek(ev.date);
        if ((matchesPlayedPerWeek[week] || 0) >= 2) {
          eventIdsToCancel.push(ev.id);
          ev.status = 'cancelled'; // Actualizar en memoria para la respuesta
        }
      }
    }

    // Persistir cancelaciones en DB
    if (eventIdsToCancel.length > 0) {
      await db.event.updateMany({
        where: { id: { in: eventIdsToCancel } },
        data: { status: 'cancelled' }
      });
      console.log(`[GET /api/events] Auto-cancelados ${eventIdsToCancel.length} eventos de partido (2+ ya jugados esa semana)`);
    }

    // 2d. Auto-actualizar estados para eventos pasados (no_players, not_played)
    const nowDt = new Date();
    const eventIdsNoPlayers: number[] = [];
    const eventIdsNotPlayed: number[] = [];
    const eventIdsCompleted: number[] = [];

    for (const ev of events) {
      const startDt = new Date(`${ev.date}T${ev.time}:00Z`);
      const isPast = startDt < nowDt;
      // Consideramos "tiempo prudente" como 4 horas después del inicio
      const isWayPast = new Date(startDt.getTime() + 4 * 60 * 60 * 1000) < nowDt;

      const confirmedCount = ev.availability.filter((a: any) => a.status === 'available').length;
      const matches = matchesByEvent[ev.id] || [];

      if (isPast) {
        if (matches.length > 0) {
          if (ev.status !== 'completed') {
            eventIdsCompleted.push(ev.id);
            ev.status = 'completed';
          }
        } else if (isWayPast && ev.status === 'scheduled') {
          if (confirmedCount < 5) {
            eventIdsNoPlayers.push(ev.id);
            ev.status = 'no_players';
          } else {
            eventIdsNotPlayed.push(ev.id);
            ev.status = 'not_played';
          }
        }
      }
    }

    if (eventIdsCompleted.length > 0) await db.event.updateMany({ where: { id: { in: eventIdsCompleted } }, data: { status: 'completed' } });
    if (eventIdsNoPlayers.length > 0) await db.event.updateMany({ where: { id: { in: eventIdsNoPlayers } }, data: { status: 'no_players' } });
    if (eventIdsNotPlayed.length > 0) await db.event.updateMany({ where: { id: { in: eventIdsNotPlayed } }, data: { status: 'not_played' } });

    // 2d. Obtener todos los mapas para vincular manualmente (fallback si el include falla)
    const maps = await db.map.findMany();
    const mapsMap = new Map(maps.map(m => [m.id, m]));


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

    // 2e. Auto-corregir disponibilidad para jugadores que jugaron partidas vinculadas
    for (const ev of events) {
      if (ev.status === 'completed') {
        const matches = matchesByEvent[ev.id] || [];
        if (matches.length > 0) {
          // Extraer todos los player_id que participaron en estas partidas
          const playerIdsInMatches = new Set<string>();
          for (const m of matches) {
            if (m.player_stats) {
              for (const ps of m.player_stats) {
                if (ps.player_id) playerIdsInMatches.add(ps.player_id);
              }
            }
          }

          for (const pId of playerIdsInMatches) {
            const currentAvail = ev.availability.find((a: any) => a.player_id === pId);
            if (!currentAvail || currentAvail.status !== 'available') {
              console.log(`[GET /api/events] Auto-corrigiendo disponibilidad para player ${pId} en evento ${ev.id} (jugó partida)`);
              // Actualizamos en DB
              await db.availability.upsert({
                where: { event_id_player_id: { event_id: ev.id, player_id: pId } },
                update: { status: 'available' },
                create: { event_id: ev.id, player_id: pId, status: 'available' }
              });
              // Actualizamos en memoria para la respuesta inmediata
              if (currentAvail) {
                currentAvail.status = 'available';
              } else {
                ev.availability.push({ 
                  id: 0, 
                  event_id: ev.id, 
                  player_id: pId, 
                  status: 'available', 
                  note: null, 
                  updated_at: new Date(),
                  player: { id: pId, name: "Auto", avatar_color: "#999" } 
                });
              }
            }
          }
        }
      }
    }
    // Enriquecer eventos con partidos vinculados y objeto de mapa
    const enrichedEvents = events.map(ev => ({
      ...ev,
      linkedMatches: matchesByEvent[ev.id] || [],
      map_obj: ev.map ? mapsMap.get(ev.map) : null
    }));

    console.log(`[GET /api/events] Devolviendo ${enrichedEvents.length} eventos para equipo ${teamId}`);

    return NextResponse.json({
      events: enrichedEvents,
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
      map: map || null,
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
