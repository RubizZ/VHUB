import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import * as bcrypt from "bcryptjs";
import { ValorantApi } from "@valpro-labs/valorant-api";
import { createId } from "@paralleldrive/cuid2";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    if (process.env.NODE_ENV !== "production") {
        console.log("🧹 Cleaning database (Dev mode)...");
        // Borramos en orden inverso a las dependencias
        await prisma.availability.deleteMany();
        await prisma.strategy.deleteMany();
        await prisma.matchPlayerStats.deleteMany();
        await prisma.event.deleteMany();
        await prisma.match.deleteMany();
        await prisma.season.deleteMany();
        await prisma.teamJoinRequest.deleteMany();
        await prisma.user.deleteMany();
        await prisma.player.deleteMany();
        await prisma.team.deleteMany();
        await prisma.map.deleteMany();
        await prisma.agent.deleteMany();
        console.log("✅ All data cleared.");
    } else {
        console.log("🛡️ Production mode detected: skipping database cleanup.");
    }

    console.log("🌱 Seeding data...");

    // 1. Fetch Maps from Valorant API
    console.log("🛰️ Fetching maps...");
    const valorantApi = new ValorantApi({ language: "es-ES" });
    const mapsData = await valorantApi.mapsEndpoints.getMapsV1();

    for (const map of mapsData) {
        // Solo guardamos mapas que tengan descripción táctica (filtramos tutoriales/rangos)
        if (map.tacticalDescription) {
            await prisma.map.upsert({
                where: { id: map.uuid },
                update: {
                    name: map.displayName,
                    displayIcon: map.displayIcon,
                    splash: map.splash,
                    listViewIcon: map.listViewIcon,
                    listViewIconTall: map.listViewIconTall,
                    premierBackground: map.premierBackgroundImage,
                    mapUrl: map.mapUrl,
                    tacticalDescription: map.tacticalDescription,
                },
                create: {
                    id: map.uuid,
                    name: map.displayName,
                    displayIcon: map.displayIcon,
                    splash: map.splash,
                    listViewIcon: map.listViewIcon,
                    listViewIconTall: map.listViewIconTall,
                    premierBackground: map.premierBackgroundImage,
                    mapUrl: map.mapUrl,
                    tacticalDescription: map.tacticalDescription,
                },
            });
        }
    }
    console.log(`✅ ${mapsData.length} maps processed.`);

    // 1.5 Fetch Agents from Valorant API
    console.log("🛰️ Fetching agents...");
    const agentsData = await valorantApi.agentsEndpoints.getAgentsV1();
    let seededAgentsCount = 0;

    for (const agent of agentsData) {
        if (agent.isPlayableCharacter) {
            const roleDisplayName = agent.role?.displayName || "duelist";
            const roleName = (() => {
                const name = roleDisplayName.toLowerCase();
                if (name.includes("duel")) return "duelist";
                if (name.includes("iniciador") || name.includes("init")) return "initiator";
                if (name.includes("control") || name.includes("controlador")) return "controller";
                if (name.includes("centinela") || name.includes("sentinel")) return "sentinel";
                return "duelist";
            })();
            const roleIcon = agent.role?.displayIcon || "";
            const bgColors = (agent.backgroundGradientColors || []).map(c => `#${c}`);

            await prisma.agent.upsert({
                where: { id: agent.uuid },
                update: {},
                create: {
                    id: agent.uuid,
                },
            });

            if (agent.abilities && Array.isArray(agent.abilities)) {
                const keyMap: Record<string, string> = {
                    "Ability1": "q",
                    "Ability2": "e",
                    "Grenade": "c",
                    "Ultimate": "x",
                    "Passive": "passive"
                };

                for (const ability of agent.abilities) {
                    const key = keyMap[ability.slot];
                    if (key && ability.displayIcon) {
                        await prisma.agentSkill.upsert({
                            where: { agentId_key: { agentId: agent.uuid, key } },
                            update: {},
                            create: {
                                agentId: agent.uuid,
                                key,
                                color: bgColors[0] || "#ffffff",
                                enabled: false
                            }
                        });
                    }
                }
            }

            seededAgentsCount++;
        }
    }
    console.log(`✅ ${seededAgentsCount} agents processed.`);

    const generateCuid = createId;

    let adminPlayerId = generateCuid();
    try {
        const existingUser = await prisma.user.findUnique({
            where: { email: "admin@vhub.com" },
            select: { playerId: true }
        });
        if (existingUser?.playerId) {
            adminPlayerId = existingUser.playerId;
        }
    } catch (e) {
        // Safe to ignore if DB or tables don't exist yet
    }

    // 2. Essential Admin Data
    const randomPassword =
        Math.random().toString(36).slice(-8) +
        Math.random().toString(36).slice(-4).toUpperCase();
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    if (process.env.NODE_ENV !== "production") {
        const riotName = "Rubiz";
        const riotTag = "000";

        let puuid = null;

        console.log(`🛰️ Fetching PUUID for ${riotName}#${riotTag}...`);
        try {
            const henrikRes = await fetch(
                `https://api.henrikdev.xyz/valorant/v1/account/${riotName}/${riotTag}`,
                {
                    headers: {
                        Authorization: process.env.HENRIK_API_KEY || "",
                    },
                },
            );
            const henrikData = await henrikRes.json();
            if (henrikRes.ok && henrikData.data) {
                puuid = henrikData.data.puuid;
                console.log(`✅ Found PUUID: ${puuid}`);
            } else {
                console.warn(
                    `⚠️ Could not fetch PUUID for ${riotName}#${riotTag}: ${henrikData.message || "Unknown error"}`,
                );
            }
        } catch (err) {
            console.warn(`⚠️ Error connecting to HenrikDev API:`, err);
        }

        const team = await prisma.team.upsert({
            where: { slug: "vhub-elite" },
            update: {},
            create: {
                name: "V-HUB Elite",
                slug: "vhub-elite",
                logo_url: "/logo.png",
                inviteCode: "VHUB-JOIN-2026",
                premierTeam: {
                    create: {
                        name: "V-HUB Elite",
                        tag: "VHUB",
                        conference: "EU_IBIT"
                    }
                },
                matchHistoryConsent: true,
            },
        });

        const player = await prisma.player.upsert({
            where: { id: adminPlayerId },
            update: {
                teamId: team.id,
                puuid,
                riot_name: riotName,
                riot_tag: riotTag,
            },
            create: {
                id: adminPlayerId,
                name: "Administrador",
                teamId: team.id,
                role: "flex",
                avatar_color: "#FF4655",
                riot_name: riotName,
                riot_tag: riotTag,
                puuid,
            },
        });

        await prisma.user.upsert({
            where: { email: "admin@vhub.com" },
            update: {
                teamId: team.id,
                playerId: player.id,
                dataConsent: true,
            },
            create: {
                name: "Administrador",
                email: "admin@vhub.com",
                password: hashedPassword,
                role: "super_admin",
                teamId: team.id,
                playerId: player.id,
                dataConsent: true,
            },
        });
    } else {
        const team = await prisma.team.upsert({
            where: { slug: "vhub-elite" },
            update: {},
            create: {
                name: "V-HUB Elite",
                slug: "vhub-elite",
                logo_url: "/logo.png",
                inviteCode: "VHUB-JOIN-2026",
                premierTeam: {
                    create: {
                        name: "V-HUB Elite",
                        tag: "VHUB",
                        conference: "EU_IBIT"
                    }
                },
                matchHistoryConsent: true,
            },
        });

        const player = await prisma.player.upsert({
            where: { id: adminPlayerId },
            update: {
                teamId: team.id,
            },
            create: {
                id: adminPlayerId,
                name: "Administrador",
                teamId: team.id,
                role: "flex",
                avatar_color: "#FF4655",
            },
        });

        await prisma.user.upsert({
            where: { email: "admin@vhub.com" },
            update: {
                teamId: team.id,
                playerId: player.id,
                dataConsent: true,
            },
            create: {
                name: "Administrador",
                email: "admin@vhub.com",
                password: hashedPassword,
                role: "super_admin",
                teamId: team.id,
                playerId: player.id,
                dataConsent: true,
            },
        });
    }

    console.log("--------------------------------------------------");
    console.log("🚀 ADMIN ACCESS CREDENTIALS:");
    console.log(`📧 Email: admin@vhub.com`);
    console.log(`🔑 Password: ${randomPassword}`);
    console.log("--------------------------------------------------");

    console.log("✅ Team and Admin linked.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
