
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const teams = await prisma.team.findMany({
    select: {
      id: true,
      name: true,
      tag: true,
      conference: true,
      division: true
    }
  });
  console.log('TEAMS_DATA:', JSON.stringify(teams));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
