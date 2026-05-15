import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  const teamId = session?.user?.teamId;
  if (!teamId) return NextResponse.json({ error: "No team context" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const mapId = searchParams.get("map_id");

  const compositions = await db.composition.findMany({
    where: {
      teamId,
      ...(mapId ? { map_id: mapId } : {})
    },
    orderBy: { updated_at: 'desc' }
  });
  
  return NextResponse.json({ compositions });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const teamId = session?.user?.teamId;
  if (!teamId) return NextResponse.json({ error: "No team context" }, { status: 400 });

  const body = await req.json();
  const { map_id, name, description, agent_1, agent_2, agent_3, agent_4, agent_5 } = body;
  
  if (!map_id || !name || !agent_1 || !agent_2 || !agent_3 || !agent_4 || !agent_5)
    return NextResponse.json({ error: "map_id, name, and 5 agents required" }, { status: 400 });

  const composition = await db.composition.create({
    data: {
      teamId,
      map_id,
      name,
      description: description || "",
      agent_1,
      agent_2,
      agent_3,
      agent_4,
      agent_5
    }
  });
  
  return NextResponse.json({ id: composition.id });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, name, description, agent_1, agent_2, agent_3, agent_4, agent_5 } = body;
  
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await db.composition.update({
    where: { id: Number(id) },
    data: {
      name,
      description,
      agent_1,
      agent_2,
      agent_3,
      agent_4,
      agent_5
    }
  });
  
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  
  await db.composition.delete({
    where: { id: Number(id) }
  });
  
  return NextResponse.json({ ok: true });
}
