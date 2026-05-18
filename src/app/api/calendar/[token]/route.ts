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

  if (!token || token === "null") {
    return new NextResponse("Token required and cannot be null", { status: 400 });
  }

  const team = await db.team.findUnique({
    where: { calendarToken: token },
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
  });

  if (!team) {
    return new NextResponse("Invalid token", { status: 404 });
  }

  const origin = req.nextUrl.origin;
  const now = new Date();

  const activeEvents = team.events.filter((ev) => {
    // 1. Excluir eventos cancelados
    const isCancelled = ev.status === "cancelled" || ev.status === "not_played" || ev.status === "no_players";
    if (isCancelled) return false;

    // 2. Excluir eventos imposibles (futuros con menos de 5 jugadores posibles)
    const startDt = new Date(`${ev.date}T${ev.time}:00Z`);
    const isPast = startDt < now;

    const unavailableCount = ev.availability.filter((a) => a.status === "unavailable").length;
    const isImpossible =
      !isPast &&
      team.players.length >= 5 &&
      team.players.length - unavailableCount < 5;

    if (isImpossible) return false;

    return true;
  });

  const calendarEvents: ics.EventAttributes[] = activeEvents.map((ev) => {
    const [year, month, day] = ev.date.split("-").map(Number);
    const [hour, minute] = ev.time.split(":").map(Number);

    // Determinar duración (default 1.5h si no hay end_time)
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

    const eventUrl = `${origin}/availability?eventId=${ev.id}`;
    const mapName = ev.map_obj?.name || ev.map || "Por definir";

    let description = `🗺️ Mapa: ${mapName}\n`;
    if (ev.description) {
      description += `📝 Notas: ${ev.description}\n`;
    }

    if (available.length > 0) description += `\n\n✅ Confirmados (${available.length}): ${available.join(", ")}`;
    if (played.length > 0) description += `\n\n💜 Jugaron (${played.length}): ${played.join(", ")}`;
    if (maybe.length > 0) description += `\n⚠️ Duda (${maybe.length}): ${maybe.join(", ")}`;
    if (unavailable.length > 0) description += `\n❌ No asisten (${unavailable.length}): ${unavailable.join(", ")}`;



    // Rich HTML Content
    let htmlContent = `<div>
      <p><strong>🗺️ Mapa:</strong> ${mapName}</p>
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
      title: `[${team.name}] ${titleText}`,
      description,
      htmlContent,
      url: eventUrl,
      status: ev.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
      categories: [ev.type],
      productId: "VHUB/Calendar",
    };
  });

  const { error, value: rawValue } = ics.createEvents(calendarEvents, {
    calName: `VHUB - ${team.name}`
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
        const ev = team.events.find((e) => e.id === Number(eventId));
        
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
      "Content-Disposition": `attachment; filename="calendar-${team.slug}.ics"`,
    },
  });
}
