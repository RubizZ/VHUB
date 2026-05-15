import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Buscamos usuarios que NO tengan un playerId vinculado
  const users = await db.user.findMany({
    where: {
      playerId: null
    },
    select: {
      id: true,
      name: true,
      email: true
    }
  });

  return NextResponse.json({ users });
}
