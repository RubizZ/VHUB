import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getRiotClient } from "@/lib/riot/client";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const playerId = (session.user as any).playerId;
  if (!playerId) return NextResponse.json({ error: "No player linked" }, { status: 404 });

  const body = await req.json();
  const { riotName, riotTag } = body;

  if (!riotName || !riotTag) 
    return NextResponse.json({ error: "Riot Name and Tag are required" }, { status: 400 });

  const client = getRiotClient();
  if (!client) 
    return NextResponse.json({ error: "Riot API key not configured" }, { status: 503 });

  try {
    // 1. Get PUUID from Riot API
    const account = await client.getAccount(riotName, riotTag);

    // 2. Update player profile in DB
    const player = await db.player.update({
      where: { id: Number(playerId) },
      data: {
        riot_name: account.gameName,
        riot_tag: account.tagLine,
        puuid: account.puuid
      }
    });

    return NextResponse.json({ 
      success: true, 
      puuid: account.puuid,
      riotName: account.gameName,
      riotTag: account.tagLine
    });
  } catch (err: any) {
    console.error("Riot Sync Error:", err);
    if (err.statusCode === 404) 
      return NextResponse.json({ error: "Cuenta de Riot no encontrada. Revisa el Nombre y el Tag." }, { status: 404 });
    
    return NextResponse.json({ error: "Error al comunicar con Riot Games" }, { status: 500 });
  }
}
