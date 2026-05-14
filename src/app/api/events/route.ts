import { NextRequest, NextResponse } from "next/server";
import { query, execute, dbReady } from "@/lib/db";

export async function GET() {
  await dbReady;
  const events = await query("SELECT * FROM events ORDER BY date ASC, time ASC");
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  await dbReady;
  const body = await req.json();
  const { title, type, date, time, description, map, premier_week } = body;
  if (!title || !date || !time) return NextResponse.json({ error: "Title, date and time required" }, { status: 400 });
  const result = await query(
    "INSERT INTO events (title, type, date, time, description, map, premier_week) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
    [title, type || "match", date, time, description || "", map || "", premier_week || null]
  );
  return NextResponse.json({ id: result[0]?.id });
}

export async function PUT(req: NextRequest) {
  await dbReady;
  const body = await req.json();
  const { id, status, match_id } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  if (status) {
    await execute("UPDATE events SET status=$1 WHERE id=$2", [status, id]);
  }
  if (match_id) {
    await execute("UPDATE events SET match_id=$1 WHERE id=$2", [match_id, id]);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await dbReady;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  await execute("DELETE FROM events WHERE id=$1", [id]);
  return NextResponse.json({ ok: true });
}
