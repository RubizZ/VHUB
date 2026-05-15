import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const request = await db.teamJoinRequest.findFirst({
      where: {
        userId: session.user.id,
        status: "pending"
      },
      include: {
        team: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return NextResponse.json({ request });
  } catch (error) {
    console.error("[GET /api/teams/requests/me] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
