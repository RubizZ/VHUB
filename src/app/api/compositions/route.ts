import { NextRequest, NextResponse } from "next/server";
import { query, execute, dbReady } from "@/lib/db";

export async function GET(req: NextRequest) {
  await dbReady;
  const { searchParams } = new URL(req.url);
  const mapId = searchParams.get("map_id");

  if (mapId) {
    const compositions = await query(
      "SELECT * FROM compositions WHERE map_id = $1 ORDER BY updated_at DESC",
      [mapId]
    );
    return NextResponse.json({ compositions });
  }

  const compositions = await query("SELECT * FROM compositions ORDER BY updated_at DESC");
  return NextResponse.json({ compositions });
}

export async function POST(req: NextRequest) {
  await dbReady;
  const body = await req.json();
  const { map_id, name, description, agent_1, agent_2, agent_3, agent_4, agent_5 } = body;
  if (!map_id || !name || !agent_1 || !agent_2 || !agent_3 || !agent_4 || !agent_5)
    return NextResponse.json({ error: "map_id, name, and 5 agents required" }, { status: 400 });

  const result = await query(
    `INSERT INTO compositions (map_id, name, description, agent_1, agent_2, agent_3, agent_4, agent_5)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [map_id, name, description || "", agent_1, agent_2, agent_3, agent_4, agent_5]
  );
  return NextResponse.json({ id: result[0]?.id });
}

export async function PUT(req: NextRequest) {
  await dbReady;
  const body = await req.json();
  const { id, name, description, agent_1, agent_2, agent_3, agent_4, agent_5 } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await execute(
    `UPDATE compositions SET name=$1, description=$2, agent_1=$3, agent_2=$4, agent_3=$5, agent_4=$6, agent_5=$7, updated_at=NOW() WHERE id=$8`,
    [name, description || "", agent_1, agent_2, agent_3, agent_4, agent_5, id]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await dbReady;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  await execute("DELETE FROM compositions WHERE id=$1", [id]);
  return NextResponse.json({ ok: true });
}
