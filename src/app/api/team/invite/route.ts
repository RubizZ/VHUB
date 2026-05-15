import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.teamId || (session.user.role !== "team_admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const newCode = crypto.randomUUID(); // Using standard random UUID

    const updatedTeam = await prisma.team.update({
      where: { id: session.user.teamId },
      data: { inviteCode: newCode }
    });

    return NextResponse.json({ inviteCode: updatedTeam.inviteCode });
  } catch (error) {
    console.error("[POST /api/team/invite] Error:", error);
    return NextResponse.json({ error: "Error al regenerar el código" }, { status: 500 });
  }
}
