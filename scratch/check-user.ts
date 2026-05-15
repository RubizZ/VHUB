
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const user = await prisma.user.findFirst({
    where: { email: 'admin@vhub.com' },
    include: { player: true }
  });
  console.log(JSON.stringify(user, null, 2));
}

check().then(() => process.exit(0));
