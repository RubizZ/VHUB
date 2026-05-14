import { NextRequest, NextResponse } from "next/server";
import { getRiotClient } from "@/lib/riot/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "status";
  const client = getRiotClient();

  if (!client) {
    return NextResponse.json({ error: "Riot API key not configured. Set RIOT_API_KEY in .env.local", configured: false }, { status: 503 });
  }

  try {
    switch (action) {
      case "status": {
        const status = await client.getPlatformStatus();
        return NextResponse.json({ status, configured: true });
      }
      case "content": {
        const locale = searchParams.get("locale") || undefined;
        const content = await client.getContent(locale);
        return NextResponse.json({ content, configured: true });
      }
      case "account": {
        const name = searchParams.get("name");
        const tag = searchParams.get("tag");
        if (!name || !tag) return NextResponse.json({ error: "name and tag required" }, { status: 400 });
        const account = await client.getAccount(name, tag);
        return NextResponse.json({ account, configured: true });
      }
      case "matchlist": {
        const puuid = searchParams.get("puuid");
        if (!puuid) return NextResponse.json({ error: "puuid required" }, { status: 400 });
        const matchlist = await client.getMatchlist(puuid);
        return NextResponse.json({ matchlist, configured: true });
      }
      case "match": {
        const matchId = searchParams.get("matchId");
        if (!matchId) return NextResponse.json({ error: "matchId required" }, { status: 400 });
        const match = await client.getMatch(matchId);
        return NextResponse.json({ match, configured: true });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, configured: true }, { status: 500 });
  }
}
