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

  const calendarEvents: ics.EventAttributes[] = team.events.map((ev) => {
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

    let description = `🏆 Evento: ${titleText}\n`;
    description += `📅 Fecha: ${ev.date} a las ${ev.time}\n`;
    description += `🗺️ Mapa: ${mapName}\n`;
    if (ev.description) {
      description += `📝 Notas: ${ev.description}\n`;
    }
    description += `🔗 Ver en VHUB: ${eventUrl}`;

    if (available.length > 0) description += `\n\n✅ Confirmados (${available.length}): ${available.join(", ")}`;
    if (played.length > 0) description += `\n\n💜 Jugaron (${played.length}): ${played.join(", ")}`;
    if (maybe.length > 0) description += `\n⚠️ Duda (${maybe.length}): ${maybe.join(", ")}`;
    if (unavailable.length > 0) description += `\n❌ No asisten (${unavailable.length}): ${unavailable.join(", ")}`;

    if (ev.map_obj?.splash) {
      description += `\n\n🖼️ Imagen de fondo del mapa: ${ev.map_obj.splash}`;
    }

    // Rich HTML Content
    let htmlContent = `<div>
      <h2>🏆 ${titleText}</h2>
      <p><strong>📅 Fecha y Hora:</strong> ${ev.date} a las ${ev.time}</p>
      <p><strong>🗺️ Mapa:</strong> ${mapName}</p>
      ${ev.description ? `<p><strong>📝 Notas:</strong> ${ev.description}</p>` : ""}
      <p><a href="${eventUrl}">🔗 Ver en VHUB y gestionar asistencia</a></p>
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

  const { error, value } = ics.createEvents(calendarEvents, {
    calName: `VHUB - ${team.name}`
  });

  if (error) {
    console.error("Error creating iCal events:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }

  return new NextResponse(value, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="calendar-${team.slug}.ics"`,
    },
  });
}
