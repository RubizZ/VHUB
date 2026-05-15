import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teams = await db.team.findMany({
    include: {
      _count: {
        select: { players: true, users: true }
      }
    },
    orderBy: { created_at: 'desc' }
  });

  return NextResponse.json({ teams });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, slug, logo_url, conference } = body;

  if (!name || !slug || !conference) {
    return NextResponse.json({ error: "Name, slug and conference are required" }, { status: 400 });
  }

  try {
    const team = await db.team.create({
      data: {
        name,
        slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        logo_url,
        conference
      }
    });

    return NextResponse.json({ team });
  } catch (err) {
    return NextResponse.json({ error: "Error creating team (slug might already exist)" }, { status: 500 });
  }
}
