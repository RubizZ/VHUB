import { NextRequest, NextResponse } from "next/server";
import { getMatches, getMMR, generateMockMatches, generateMockMMR } from "@/lib/valorant-api";
import { analyzePlayerStats } from "@/lib/stats-analyzer";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  const tag = searchParams.get("tag");
  const region = searchParams.get("region") || process.env.VALORANT_REGION || "eu";
  const type = searchParams.get("type") || "stats";

  if (!name || !tag) {
    return NextResponse.json({ error: "name and tag required" }, { status: 400 });
  }

  const hasApiKey = !!process.env.HENRIK_API_KEY;

  if (type === "mmr") {
    if (hasApiKey) {
      const mmr = await getMMR(region, name, tag);
      return NextResponse.json({ mmr, mock: false });
    }
    return NextResponse.json({ mmr: generateMockMMR(), mock: true });
  }

  // Default: full stats
  let matches;
  let mock = false;
  if (hasApiKey) {
    matches = await getMatches(region, name, tag, "competitive", 20);
  }
  if (!matches || matches.length === 0) {
    matches = generateMockMatches(name);
    mock = true;
  }

  const stats = analyzePlayerStats(matches, name, tag);
  let mmr;
  if (hasApiKey) {
    mmr = await getMMR(region, name, tag);
  }
  if (!mmr) {
    mmr = generateMockMMR();
  }

  return NextResponse.json({ stats, mmr, matches: matches.slice(0, 10), mock });
}
