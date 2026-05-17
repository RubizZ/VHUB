/* eslint-disable no-undef */
import { NextRequest, NextResponse } from "next/server";
import { getAccount, getMatches, getMMR } from "@/lib/henrik-api";
import { analyzeHenrikPlayerStats } from "@/lib/henrik-stats-analyzer";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "status";

  try {
    switch (action) {
      case "status": {
        // Podríamos usar la de Henrik o la de Riot, pero Henrik es más estable para nosotros
        return NextResponse.json({ status: "available", configured: true });
      }
      case "stats": {
        const name = searchParams.get("name");
        const tag = searchParams.get("tag");
        const region = searchParams.get("region") || "eu";
        
        if (!name || !tag) return NextResponse.json({ error: "name and tag required" }, { status: 400 });

        // Verificar consentimiento en base de datos
        const dbPlayer = await db.player.findFirst({
          where: {
            riot_name: { equals: name, mode: "insensitive" },
            riot_tag: { equals: tag, mode: "insensitive" }
          },
          include: { user: { select: { dataConsent: true } } }
        });

        if (dbPlayer && dbPlayer.user?.dataConsent !== true) {
          return NextResponse.json({
            error: "consent_required",
            message: "Este jugador no ha dado su consentimiento para procesar y mostrar sus estadísticas de juego en VHUB."
          }, { status: 403 });
        }

        // 1. Obtener Historial (V3 devuelve el objeto completo de cada partida)
        const matches = await getMatches(region, name, tag, undefined, 10);
        if (!matches) return NextResponse.json({ error: "No se pudieron obtener las partidas" }, { status: 502 });

        // 2. Obtener MMR (Rango)
        const mmrData = await getMMR(region, name, tag);
        const mmr = mmrData ? {
          currenttierpatched: mmrData.current_data.currenttierpatched,
          ranking_in_tier: mmrData.current_data.ranking_in_tier,
          mmr_change_to_last_game: mmrData.current_data.mmr_change_to_last_game,
          elo: mmrData.current_data.elo
        } : null;

        // 3. Analizar estadísticas
        const stats = analyzeHenrikPlayerStats(matches, name, tag);

        return NextResponse.json({
          stats,
          mmr,
          matches,
          mock: false,
          configured: true
        });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, configured: true }, { status: 500 });
  }
}
