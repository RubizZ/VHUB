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

    let description = ev.description || "";
    if (available.length > 0) description += `\n\n✅ Confirmados (${available.length}): ${available.join(", ")}`;
    if (maybe.length > 0) description += `\n⚠️ Duda: ${maybe.join(", ")}`;
    if (unavailable.length > 0) description += `\n❌ No asisten: ${unavailable.join(", ")}`;
    
    if (ev.map) {
      description += `\n\n🗺️ Mapa: ${ev.map}`;
    }

    return {
      start: [year, month, day, hour, minute],
      duration,
      title: `[${team.name}] ${ev.title}`,
      description,
      status: ev.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
      categories: [ev.type],
      productId: "VHUB/Calendar",
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
      "Content-Disposition": `attachment; filename="calendar-${team.slug}.ics"`,
    },
  });
}
