import { NextRequest, NextResponse } from "next/server";
import { query, execute, dbReady } from "@/lib/db";

export async function GET() {
  await dbReady;
  const players = await query("SELECT * FROM players ORDER BY id");
  return NextResponse.json({ players });
}

export async function POST(req: NextRequest) {
  await dbReady;
  const body = await req.json();
  const { name, riot_name, riot_tag, role, avatar_color } = body;
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const result = await query(
    "INSERT INTO players (name, riot_name, riot_tag, role, avatar_color) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [name, riot_name || "", riot_tag || "", role || "flex", avatar_color || "#FF4655"]
  );
  return NextResponse.json({ id: result[0]?.id });
}

export async function PUT(req: NextRequest) {
  await dbReady;
  const body = await req.json();
  const { id, name, riot_name, riot_tag, role, avatar_color } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  await execute(
    "UPDATE players SET name=$1, riot_name=$2, riot_tag=$3, role=$4, avatar_color=$5 WHERE id=$6",
    [name, riot_name || "", riot_tag || "", role || "flex", avatar_color || "#FF4655", id]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await dbReady;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  await execute("DELETE FROM players WHERE id=$1", [id]);
  return NextResponse.json({ ok: true });
}
