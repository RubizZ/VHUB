import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "team_admin" && session.user.role !== "super_admin") || !session.user.teamId) {
      return NextResponse.json({ error: "No tienes permisos de administrador" }, { status: 403 });
    }

    const requests = await db.teamJoinRequest.findMany({
      where: {
        teamId: session.user.teamId,
        status: "pending"
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("[GET /api/teams/requests] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
