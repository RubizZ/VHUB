import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const player = await prisma.player.findUnique({ where: { id: 'c000000000000000000000000' } })
  const user = await prisma.user.findUnique({ where: { id: 'cmp69ujkv0001a3pw63irw7mx' } })
  console.log('PLAYER:', player)
  console.log('USER:', user)
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
