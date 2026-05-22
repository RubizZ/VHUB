import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await db.user.update({
      where: { id: session.user.id },
      data: { lastActiveAt: new Date() }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating user activity:", error);
    return NextResponse.json({ error: "Failed to update activity" }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
