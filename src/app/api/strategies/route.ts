import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const compositionId = searchParams.get("composition_id");

  const strategies = await db.strategy.findMany({
    where: compositionId ? { composition_id: Number(compositionId) } : undefined,
    orderBy: [
      { side: 'asc' },
      { updated_at: 'desc' }
    ]
  });
  
  return NextResponse.json({ strategies });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { composition_id, name, side, description, canvas_data } = body;
  
  if (!composition_id || !name)
    return NextResponse.json({ error: "composition_id and name required" }, { status: 400 });

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
