/* eslint-disable no-undef */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { valorantApi } from '@/lib/valorant-api';

let lastSync = 0;
const SYNC_COOLDOWN = 12 * 60 * 60 * 1000; // 12 horas

export async function GET() {
  try {
    let agents = await prisma.agent.findMany({
      orderBy: { name: 'asc' },
    });

    const now = Date.now();
    const shouldSync = agents.length === 0 || (now - lastSync > SYNC_COOLDOWN);

    if (shouldSync) {
      console.log('🔄 Syncing agents from Valorant API...');
      const agentsData = await valorantApi.agentsEndpoints.getAgentsV1();

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
          const roleIcon = agent.role?.displayIcon || '';
          const bgColors = (agent.backgroundGradientColors || []).map(c => `#${c}`);

          await prisma.agent.upsert({
            where: { id: agent.uuid },
            update: {
              name: agent.displayName,
              role: roleName,
              displayIcon: agent.displayIcon,
              killfeedPortrait: agent.killfeedPortrait,
              fullPortrait: agent.fullPortrait,
              background: agent.background,
              roleIcon: roleIcon,
              bgColors: bgColors,
            },
            create: {
              id: agent.uuid,
              name: agent.displayName,
              role: roleName,
              displayIcon: agent.displayIcon,
              killfeedPortrait: agent.killfeedPortrait,
              fullPortrait: agent.fullPortrait,
              background: agent.background,
              roleIcon: roleIcon,
              bgColors: bgColors,
            },
          });
        }
      }
      agents = await prisma.agent.findMany({ orderBy: { name: 'asc' } });
      lastSync = now;
      console.log('✅ Agents sync completed.');
    }

    return NextResponse.json({ agents });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
}
