/* eslint-disable no-undef */
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import * as ics from "ics";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const includeProvisionalStr = req.nextUrl.searchParams.get("includeProvisional");
  const includeProvisional = includeProvisionalStr !== "false";

  if (!token || token === "null") {
    return new NextResponse("Token required", { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { calendarToken: token },
    include: {
      player: true,
      team: {
        include: {
          players: true,
          events: {
            include: {
              map_obj: true,
              availability: {
                include: {
                  player: {
                    select: { name: true }
                  }
                }
              }
            },
            orderBy: { date: "asc" }
          }
        }
      }
    }
  });

  if (!user || !user.team) {
    return new NextResponse("Invalid token or no team context", { status: 404 });
  }

  const playerId = user.playerId;
  const now = new Date();
  const origin = req.nextUrl.origin;

  const calendarEvents: ics.EventAttributes[] = user.team.events
    .filter((ev) => {
      // 1. Excluir eventos cancelados
      const isCancelled = ev.status === "cancelled" || ev.status === "not_played" || ev.status === "no_players";
      if (isCancelled) return false;

      const myAvail = ev.availability.find(a => a.player_id === playerId);
      const myStatus = myAvail?.status || "pending";
      const isInterested = myStatus === "available" || myStatus === "maybe" || myStatus === "played";
      
      if (!isInterested) return false;

      const startDt = new Date(`${ev.date}T${ev.time}:00Z`);
      const isPast = startDt < now;

      if (isPast) {
        return ev.status === 'completed';
      }

      // 2. Excluir eventos imposibles (futuros con menos de 5 jugadores posibles)
      const unavailableCount = ev.availability.filter((a) => a.status === "unavailable").length;
      const isImpossible =
        !isPast &&
        user.team!.players.length >= 5 &&
        user.team!.players.length - unavailableCount < 5;

      if (isImpossible) return false;

      if (!includeProvisional) {
        const confirmedCount = ev.availability.filter((a) => a.status === "available" || a.status === "played").length;
        const playedCount = ev.availability.filter((a) => a.status === "played").length;
        const isProvisional = confirmedCount < 5 && playedCount === 0;
        if (isProvisional) return false;
      }

      return true;
    })
    .map((ev) => {
      const [year, month, day] = ev.date.split("-").map(Number);
      const [hour, minute] = ev.time.split(":").map(Number);

      const myAvail = ev.availability.find(a => a.player_id === playerId);
      const myStatus = myAvail?.status || "pending";

      const confirmedCount = ev.availability.filter((a) => a.status === "available" || a.status === "played").length;

      let duration: ics.DurationObject = { hours: 1, minutes: 30 };
      if (ev.end_date && ev.end_time) {
        const start = new Date(`${ev.date}T${ev.time}:00Z`);
        const end = new Date(`${ev.end_date}T${ev.end_time}:00Z`);
        const diffMs = end.getTime() - start.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        duration = { hours: Math.floor(diffMin / 60), minutes: diffMin % 60 };
      }

      // Preparar descripción con disponibilidad
      const available = ev.availability
        .filter((a) => a.status === "available")
        .map((a) => a.player.name);
      const maybe = ev.availability
        .filter((a) => a.status === "maybe")
        .map((a) => a.player.name);
      const unavailable = ev.availability
        .filter((a) => a.status === "unavailable")
        .map((a) => a.player.name);
      const played = ev.availability
        .filter((a) => a.status === "played")
        .map((a) => a.player.name);

      // Resolver título si es null
      let titleText = ev.title;
      if (!titleText) {
        if (ev.type === "practice") titleText = "Entrenamiento";
        else if (ev.type === "playoffs") titleText = "Playoffs Premier";
        else if (ev.type === "match") titleText = "Partido Premier";
        else titleText = "Evento";
      }

      const isProvisional = confirmedCount < 5 && played.length === 0;
      const displayTitle = isProvisional ? `${titleText} [Provisional]` : titleText;
      const eventUrl = `${origin}/availability?eventId=${ev.id}`;
      const mapName = ev.map_obj?.name || ev.map || "Por definir";

      let description = `🗺️ Mapa: ${mapName}\n`;
      description += `👤 Tu Estado: ${myStatus.toUpperCase()}\n`;
      if (isProvisional) {
        description += `⏳ Convocatoria provisional: Se requieren al menos 5 confirmados para disputar el evento.\n`;
      }
      if (ev.description) {
        description += `📝 Notas: ${ev.description}\n`;
      }

      description += `\n`; // Espacio de separación limpio

      const attendeeLists = [];
      if (available.length > 0) attendeeLists.push(`✅ Confirmados (${available.length}): ${available.join(", ")}`);
      if (played.length > 0) attendeeLists.push(`💜 Jugaron (${played.length}): ${played.join(", ")}`);
      if (maybe.length > 0) attendeeLists.push(`⚠️ Duda (${maybe.length}): ${maybe.join(", ")}`);
      if (unavailable.length > 0) attendeeLists.push(`❌ No asisten (${unavailable.length}): ${unavailable.join(", ")}`);

      description += attendeeLists.join("\n");

      // Rich HTML Content
      let htmlContent = `<div>
        <p><strong>🗺️ Mapa:</strong> ${mapName}</p>
        <p><strong>👤 Tu Estado:</strong> <span style="text-transform: uppercase;">${myStatus}</span></p>
        ${isProvisional ? `<p style="color: #d97706; margin: 4px 0 0 0;"><strong>⏳ Convocatoria provisional:</strong> Se requieren al menos 5 confirmados para disputar el evento.</p>` : ""}
        ${ev.description ? `<p><strong>📝 Notas:</strong> ${ev.description}</p>` : ""}
        <hr style="border: 0; border-top: 1px solid #ccc; margin: 10px 0;" />
      `;

      if (available.length > 0) {
        htmlContent += `<p><strong>✅ Confirmados (${available.length}):</strong> ${available.join(", ")}</p>`;
      }
      if (played.length > 0) {
        htmlContent += `<p><strong>💜 Jugaron (${played.length}):</strong> ${played.join(", ")}</p>`;
      }
      if (maybe.length > 0) {
        htmlContent += `<p><strong>⚠️ Duda (${maybe.length}):</strong> ${maybe.join(", ")}</p>`;
      }
      if (unavailable.length > 0) {
        htmlContent += `<p><strong>❌ No asisten (${unavailable.length}):</strong> ${unavailable.join(", ")}</p>`;
      }

      if (ev.map_obj?.splash) {
        htmlContent += `<div style="margin-top: 15px;"><img src="${ev.map_obj.splash}" alt="${mapName}" style="max-width: 100%; border-radius: 8px;" /></div>`;
      }
      htmlContent += `</div>`;

      return {
        start: [year, month, day, hour, minute],
        duration,
        title: displayTitle,
        description,
        htmlContent,
        url: eventUrl,
        status: ev.status === "cancelled" ? "CANCELLED" : (isProvisional ? "TENTATIVE" : "CONFIRMED"),
        categories: [ev.type],
        productId: "VHUB/PersonalCalendar",
      };
    });

  const { error, value: rawValue } = ics.createEvents(calendarEvents, {
    calName: `VHUB Personal - ${user.player?.name || user.email}`
  });
  let value = rawValue;

  if (error) {
    console.error("Error creating iCal events:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }

  // Inyectar imágenes de cabecera y adjuntos (IMAGE y ATTACH) en el archivo .ics
  if (value) {
    const parts = value.split("BEGIN:VEVENT");
    const processedParts = parts.map((part, idx) => {
      if (idx === 0) return part;

      const eventIdMatch = part.match(/eventId=([^&\s\r\n\\]+)/);
      if (eventIdMatch) {
        const eventId = eventIdMatch[1];
        const ev = user.team!.events.find((e) => e.id === Number(eventId));
        
        let extraProps = "";
        const eventUrl = `${origin}/availability?eventId=${eventId}`;
        extraProps += `ATTACH;VALUE=URI:${eventUrl}\r\n`;

        const splashUrl = ev?.map_obj?.premierBackground || ev?.map_obj?.splash;
        if (splashUrl) {
          const imageProp = `IMAGE;VALUE=URI;DISPLAY=FULLSIZE;FMTTYPE=image/png:${splashUrl}`;
          const attachProp = `ATTACH;FMTTYPE=image/png:${splashUrl}`;
          extraProps += `${imageProp}\r\n${attachProp}\r\n`;
        }
        return part.replace("END:VEVENT", `${extraProps}END:VEVENT`);
      }
      return part;
    });
    value = processedParts.join("BEGIN:VEVENT");
  }

  return new NextResponse(value, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="personal-calendar.ics"`,
    },
  });
}
