import { NextRequest, NextResponse } from "next/server";
import { query, execute, dbReady } from "@/lib/db";

export async function GET(req: NextRequest) {
  await dbReady;
  const { searchParams } = new URL(req.url);
  const compositionId = searchParams.get("composition_id");

  if (compositionId) {
    const strategies = await query(
      "SELECT * FROM strategies WHERE composition_id = $1 ORDER BY side ASC, updated_at DESC",
      [compositionId]
    );
    return NextResponse.json({ strategies });
  }

  const strategies = await query("SELECT * FROM strategies ORDER BY updated_at DESC");
  return NextResponse.json({ strategies });
}

export async function POST(req: NextRequest) {
  await dbReady;
  const body = await req.json();
  const { composition_id, name, side, description, canvas_data } = body;
  if (!composition_id || !name)
    return NextResponse.json({ error: "composition_id and name required" }, { status: 400 });

  const result = await query(
    `INSERT INTO strategies (composition_id, name, side, description, canvas_data)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [composition_id, name, side || "attack", description || "", canvas_data ? JSON.stringify(canvas_data) : "{}"]
  );
  return NextResponse.json({ id: result[0]?.id });
}

export async function PUT(req: NextRequest) {
  await dbReady;
  const body = await req.json();
  const { id, name, side, description, canvas_data } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await execute(
    `UPDATE strategies SET name=$1, side=$2, description=$3, canvas_data=$4, updated_at=NOW() WHERE id=$5`,
    [name, side, description, canvas_data ? JSON.stringify(canvas_data) : "{}", id]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await dbReady;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  await execute("DELETE FROM strategies WHERE id=$1", [id]);
  return NextResponse.json({ ok: true });
}
