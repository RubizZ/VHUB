import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const matches = await prisma.match.findMany({ select: { queue_id: true } });
  console.log("Distinct queues:", [...new Set(matches.map(m => m.queue_id))]);
}

run();
