import { prisma } from "@/lib/db";
import { ValorantApi } from "@valpro-labs/valorant-api";
import { Prisma } from "@prisma/client";
import { unstable_cache, revalidateTag } from "next/cache";

export interface HydratedAgentSkill {
    id?: string;
    agentId: string;
    key: string;
    economy: Prisma.JsonValue | null;
    deployment: Prisma.JsonValue | null;
    lifetime: Prisma.JsonValue | null;
    resolution: Prisma.JsonValue | null;
    color: string;
    enabled: boolean;
    name: string;
    description: string;
    type: string;
    displayIcon: string;
}

export interface HydratedAgent {
    id: string;
    name: string;
    role: string;
    displayIcon: string;
    killfeedPortrait: string;
    fullPortrait: string;
    background: string;
    roleIcon: string;
    bgColors: string[];
    skills: HydratedAgentSkill[];
}

export function invalidateAgentsCache(language?: string) {
    revalidateTag("agents");
}

export const getHydratedAgents = unstable_cache(
    async (language: string = "es-ES"): Promise<HydratedAgent[]> => {
        const api = new ValorantApi({ language: language as any });
    const agentsData = await api.agentsEndpoints.getAgentsV1(true);

    // Fetch local engine skills
    const dbAgents = await prisma.agent.findMany({
        include: { skills: true },
    });

    const dbAgentsMap = new Map(dbAgents.map((a) => [a.id, a]));

    const hydratedAgents: HydratedAgent[] = [];

    for (const agent of agentsData) {
        const roleDisplayName = agent.role?.displayName || "duelist";
        const roleName = (() => {
            const name = roleDisplayName.toLowerCase();
            if (name.includes("duel")) return "duelist";
            if (name.includes("iniciador") || name.includes("init"))
                return "initiator";
            if (name.includes("control") || name.includes("controlador"))
                return "controller";
            if (name.includes("centinela") || name.includes("sentinel"))
                return "sentinel";
            return "duelist";
        })();
        const bgColors = (agent.backgroundGradientColors || []).map(
            (c) => `#${c}`,
        );

        const localAgent = dbAgentsMap.get(agent.uuid) || { skills: [] };

        // Sync agent ID if missing
        if (!dbAgentsMap.has(agent.uuid)) {
            try {
                await prisma.agent.upsert({
                    where: { id: agent.uuid },
                    update: {},
                    create: { id: agent.uuid },
                });
            } catch (e) {
                console.error("Error upserting agent ID", e);
            }
        }

        const keyMap: Record<string, string> = {
            Ability1: "q",
            Ability2: "e",
            Grenade: "c",
            Ultimate: "x",
            Passive: "passive",
        };

        const hydratedSkills: HydratedAgentSkill[] = [];
        if (agent.abilities && Array.isArray(agent.abilities)) {
            for (const ability of agent.abilities) {
                const key = keyMap[ability.slot];
                if (key && ability.displayIcon) {
                    let localSkill = localAgent.skills.find(
                        (s) => s.key === key,
                    );

                    if (!localSkill) {
                        try {
                            localSkill = await prisma.agentSkill.upsert({
                                where: {
                                    agentId_key: { agentId: agent.uuid, key },
                                },
                                update: {},
                                create: {
                                    agentId: agent.uuid,
                                    key,
                                    color: bgColors[0] || "#ffffff",
                                    enabled: false,
                                },
                            });
                        } catch (e) {
                            console.error("Error upserting agent skill", e);
                        }
                    }

                    hydratedSkills.push({
                        // Local engine props
                        id: localSkill?.id,
                        agentId: localSkill?.agentId || agent.uuid,
                        key,
                        economy: localSkill?.economy || null,
                        deployment: localSkill?.deployment || null,
                        lifetime: localSkill?.lifetime || null,
                        resolution: localSkill?.resolution || null,
                        color: localSkill?.color || bgColors[0] || "#ffffff",
                        enabled: localSkill?.enabled ?? false,
                        // Valorant-API localized & visual props
                        name: ability.displayName,
                        description: ability.description,
                        type: ability.slot,
                        displayIcon: ability.displayIcon,
                    });
                }
            }
        }

        hydratedAgents.push({
            id: agent.uuid,
            // Valorant-API visual props
            name: agent.displayName,
            role: roleName,
            displayIcon: agent.displayIcon,
            killfeedPortrait: agent.killfeedPortrait,
            fullPortrait: agent.fullPortrait,
            background: agent.background,
            roleIcon: agent.role?.displayIcon || "",
            bgColors,
            // Hydrated skills
            skills: hydratedSkills,
        });
    }

        return hydratedAgents;
    },
    ["agents"],
    { tags: ["agents"], revalidate: 43200 }
);
