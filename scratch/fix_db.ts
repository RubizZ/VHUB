import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Fix the teamId for player 2
  const updatedPlayer = await prisma.player.update({
    where: { id: 'c000000000000000000000000' },
    data: { teamId: 'cmp69uji30000a3pwarm82ptj' }
  })
  console.log('UPDATED PLAYER:', updatedPlayer)
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
