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
    return new NextResponse("Token required", { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { calendarToken: token },
    include: {
      player: true,
      team: {
        include: {
          events: {
            include: {
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

  const calendarEvents: ics.EventAttributes[] = user.team.events
    .filter((ev) => {
      const myAvail = ev.availability.find(a => a.player_id === playerId);
      const myStatus = myAvail?.status || "pending";
      const isInterested = myStatus === "available" || myStatus === "maybe";
      
      if (!isInterested) return false;

      const startDt = new Date(`${ev.date}T${ev.time}:00Z`);
      const isPast = startDt < now;

      if (isPast) {
        // Para eventos pasados, solo mostrar si efectivamente se jugaron (vía Match.event_id)
        // Pero en esta API, team.events no tiene linkedMatches directamente.
        // Sin embargo, ev.status ya debería estar como 'completed' si se jugaron,
        // gracias a la lógica que añadimos a /api/events.
        // Pero espera, /api/events actualiza la DB. Así que podemos confiar en ev.status.
        
        // Buscamos si hay algún match en la DB vinculado a este evento
        // Para ser más precisos, podríamos haber incluido matches en la query inicial.
        return ev.status === 'completed';
      }

      return true;
    })
    .map((ev) => {
      const [year, month, day] = ev.date.split("-").map(Number);
    const [hour, minute] = ev.time.split(":").map(Number);

    const myAvail = ev.availability.find(a => a.player_id === playerId);
    const myStatus = myAvail?.status || "pending";
    
    let statusPrefix = "";
    if (myStatus === "available") statusPrefix = "✅ ";
    else if (myStatus === "maybe") statusPrefix = "⚠️ ";
    else if (myStatus === "unavailable") statusPrefix = "❌ ";
    else statusPrefix = "⏳ ";

    let duration: ics.DurationObject = { hours: 1, minutes: 30 };
    if (ev.end_date && ev.end_time) {
      const start = new Date(`${ev.date}T${ev.time}:00Z`);
      const end = new Date(`${ev.end_date}T${ev.end_time}:00Z`);
      const diffMs = end.getTime() - start.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      duration = { hours: Math.floor(diffMin / 60), minutes: diffMin % 60 };
    }

    const available = ev.availability.filter(a => a.status === "available").map(a => a.player.name);
    let description = ev.description || "";
    description += `\n\nTu estado: ${myStatus.toUpperCase()}`;
    if (available.length > 0) description += `\n\nConfirmados (${available.length}): ${available.join(", ")}`;
    if (ev.map) description += `\nMapa: ${ev.map}`;

    return {
      start: [year, month, day, hour, minute],
      duration,
      title: `${statusPrefix}${ev.title}`,
      description,
      status: ev.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
      categories: [ev.type],
      productId: "VHUB/PersonalCalendar",
    };
  });

  const { error, value } = ics.createEvents(calendarEvents);

  if (error) {
    console.error("Error creating iCal events:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }

  return new NextResponse(value, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="personal-calendar.ics"`,
    },
  });
}
