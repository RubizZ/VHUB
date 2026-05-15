import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  const teamId = session?.user?.teamId;
  if (!teamId) return NextResponse.json({ error: "No team context" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const compositionId = searchParams.get("composition_id");

  const strategies = await db.strategy.findMany({
    where: {
      composition: { teamId },
      ...(compositionId ? { composition_id: Number(compositionId) } : {})
    },
    orderBy: [
      { side: 'asc' },
      { updated_at: 'desc' }
    ]
  });
  
  return NextResponse.json({ strategies });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const teamId = session?.user?.teamId;
  if (!teamId) return NextResponse.json({ error: "No team context" }, { status: 400 });

  const body = await req.json();
  const { composition_id, name, side, description, canvas_data } = body;
  
  if (!composition_id || !name)
    return NextResponse.json({ error: "composition_id and name required" }, { status: 400 });

  // Validar que la composición pertenece al equipo
  const comp = await db.composition.findUnique({
    where: { id: Number(composition_id), teamId }
  });
  if (!comp) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const strategy = await db.strategy.create({
    data: {
      composition_id: Number(composition_id),
      name,
      side: side || "attack",
      description: description || "",
      canvas_data: canvas_data || {}
    }
  });
  
  return NextResponse.json({ id: strategy.id });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, name, side, description, canvas_data } = body;
  
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await db.strategy.update({
    where: { id: Number(id) },
    data: {
      name,
      side,
      description,
      canvas_data: canvas_data || undefined
    }
  });
  
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  
  await db.strategy.delete({
    where: { id: Number(id) }
  });
  
  return NextResponse.json({ ok: true });
}
