/* global console */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccount } from "@/lib/henrik-api";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const playerId = session.user.playerId;
    if (!playerId)
        return NextResponse.json(
            { error: "No player linked" },
            { status: 404 },
        );

    const body = await req.json();
    const { riotName, riotTag } = body;

    if (!riotName || !riotTag)
        return NextResponse.json(
            { error: "Riot Name and Tag are required" },
            { status: 400 },
        );

    try {
        // 1. Get PUUID from Henrik API
        // NOTE FOR THE FUTURE: The official Riot API returns a 78-character ENCRYPTED, app-specific PUUID.
        // However, the Henrik API and the in-game Valorant Premier match history use the global unencrypted 36-character PUUID.
        // To avoid a PUUID mismatch (which would hide all matches under privacy filters), we retrieve the 36-character PUUID from HenrikDev.
        // TODO: When we migrate the entire app (both profile sync AND match sync) to the official Riot Production API in the future,
        // revert this to use 'client.getAccount' from our Riot client so all PUUIDs align under Riot's encrypted format.
        const account = await getAccount(riotName, riotTag);
        if (!account) {
            return NextResponse.json(
                {
                    error: "Cuenta de Riot no encontrada. Revisa el Nombre y el Tag.",
                },
                { status: 404 },
            );
        }

        // 2. Update player profile in DB
        await db.player.update({
            where: { id: String(playerId) },
            data: {
                riot_name: account.name,
                riot_tag: account.tag,
                puuid: account.puuid,
            },
        });

        return NextResponse.json({
            success: true,
            puuid: account.puuid,
            riotName: account.name,
            riotTag: account.tag,
        });
    } catch (err) {
        console.error("Riot Sync Error:", err);
        return NextResponse.json(
            { error: "Error al comunicar con la API de Valorant" },
            { status: 500 },
        );
    }
}
