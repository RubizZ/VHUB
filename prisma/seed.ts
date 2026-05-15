import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as bcrypt from 'bcryptjs';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding essential data...');

  const hashedPassword = await bcrypt.hash('vhub123', 10);

  // Crear Equipo V-HUB
  const team = await prisma.team.upsert({
    where: { slug: 'vhub-elite' },
    update: {},
    create: {
      name: 'V-HUB Elite',
      slug: 'vhub-elite',
      logo_url: '/logo.png',
      inviteCode: 'VHUB-JOIN-2026',
    },
  });

  // Crear Perfil de Jugador para el Admin
  const player = await prisma.player.create({
    data: {
      name: 'Administrador',
      teamId: team.id,
      role: 'flex',
      avatar_color: '#FF4655',
      riot_name: 'Admin',
      riot_tag: 'VHUB',
    },
  });

  // Crear Super Admin vinculado
  await prisma.user.upsert({
    where: { email: 'admin@vhub.com' },
    update: {
      teamId: team.id,
      playerId: player.id,
    },
    create: {
      name: 'Administrador',
      email: 'admin@vhub.com',
      password: hashedPassword,
      role: 'super_admin',
      teamId: team.id,
      playerId: player.id,
    },
  });

  console.log('✅ Team V-HUB created and Admin linked.');
  console.log('👉 Admin Player ID:', player.id);
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
