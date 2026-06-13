import { NextResponse } from "next/server";
import { getWeapons } from "@/lib/domain/weapons";

export const revalidate = 3600; // revalidar cada hora

export async function GET() {
  try {
    const weapons = await getWeapons();
    return NextResponse.json({ weapons });
  } catch {
    return NextResponse.json({ error: "Error fetching weapons" }, { status: 500 });
  }
}
