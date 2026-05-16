import { db } from "@/lib/db";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    console.log("[GET /api/users/calendar-token] Session:", {
      hasSession: !!session,
      userId: userId,
      userEmail: session?.user?.email
    });

    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    let user = await db.user.findUnique({
      where: { id: userId },
      select: { calendarToken: true }
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (!user.calendarToken) {
      const newToken = crypto.randomUUID();
      user = await db.user.update({
        where: { id: userId },
        data: { calendarToken: newToken },
        select: { calendarToken: true }
      });
    }

    return NextResponse.json({ token: user.calendarToken });
  } catch (error: any) {
    console.error("[GET /api/users/calendar-token] ERROR:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const newToken = crypto.randomUUID();
  await db.user.update({
    where: { id: userId },
    data: { calendarToken: newToken }
  });

  return NextResponse.json({ token: newToken });
}
