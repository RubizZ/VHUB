import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mapId = searchParams.get("map_id");

  const compositions = await db.composition.findMany({
    where: mapId ? { map_id: mapId } : undefined,
    orderBy: { updated_at: 'desc' }
  });
  
  return NextResponse.json({ compositions });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { map_id, name, description, agent_1, agent_2, agent_3, agent_4, agent_5 } = body;
  
  if (!map_id || !name || !agent_1 || !agent_2 || !agent_3 || !agent_4 || !agent_5)
    return NextResponse.json({ error: "map_id, name, and 5 agents required" }, { status: 400 });

  const composition = await db.composition.create({
    data: {
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
