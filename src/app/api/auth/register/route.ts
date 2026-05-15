import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, inviteCode } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json({ error: "El correo ya está en uso" }, { status: 400 });
    }

    let teamIdToJoin = null;

    if (inviteCode) {
      const team = await db.team.findUnique({ where: { inviteCode } });
      if (!team) {
        return NextResponse.json({ error: "Código de invitación inválido" }, { status: 400 });
      }
      teamIdToJoin = team.id;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: "member",
          teamId: teamIdToJoin
        }
      });

      if (teamIdToJoin) {
        const player = await tx.player.create({
          data: {
            name: newUser.name || "Jugador",
            teamId: teamIdToJoin,
            role: "flex"
          }
        });

        await tx.user.update({
          where: { id: newUser.id },
          data: { playerId: player.id }
        });
      }

      return newUser;
    });

    return NextResponse.json({ 
      success: true, 
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error("[REGISTER API] Error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
