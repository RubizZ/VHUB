import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; }>; }
) {
  const session = await auth();
  if (session?.user?.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const team = await db.team.findUnique({
    where: { id: (await params).id },
    include: {
      _count: {
        select: { players: true, users: true, matches: true, compositions: true }
      }
    }
  });

  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  return NextResponse.json({ team });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; }>; }
) {
  const session = await auth();
  if (session?.user?.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, slug, logo_url, conference, tag, division } = body;

  try {
    const team = await db.team.update({
      where: { id: (await params).id },
      data: {
        name,
        slug: slug?.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        logo_url,
        conference,
        tag,
        division: division ? Number(division) : null
      }
    });

    return NextResponse.json({ team });
  } catch (err) {
    return NextResponse.json({ error: "Error updating team" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; }>; }
) {
  const session = await auth();
  if (session?.user?.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await db.team.delete({
      where: { id: (await params).id }
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Error deleting team" }, { status: 500 });
  }
}
