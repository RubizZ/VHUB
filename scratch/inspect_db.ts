import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const teams = await prisma.team.findMany();
  console.log("TEAMS:", teams.map(t => ({ id: t.id, name: t.name, slug: t.slug })));

  const matches = await prisma.match.findMany({
    include: {
      player_stats: {
        select: { player_id: true }
      }
    }
  });
  console.log("MATCHES:", matches.map(m => ({ id: m.id, teamId: m.teamId, riot_match_id: m.riot_match_id, statsCount: m.player_stats.length })));

  const users = await prisma.user.findMany();
  console.log("USERS:", users.map(u => ({ id: u.id, email: u.email, teamId: u.teamId, dataConsent: u.dataConsent })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
