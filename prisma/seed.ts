import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as bcrypt from 'bcryptjs';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  if (process.env.NODE_ENV !== 'production') {
    console.log('🧹 Cleaning database (Dev mode)...');
    // Borramos en orden inverso a las dependencias
    await prisma.availability.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.composition.deleteMany();
    await prisma.message.deleteMany();
    await prisma.matchPlayerStats.deleteMany();
    await prisma.match.deleteMany();
    await prisma.event.deleteMany();
    await prisma.teamJoinRequest.deleteMany();
    await prisma.user.deleteMany();
    await prisma.player.deleteMany();
    await prisma.team.deleteMany();
    // No borramos 'Map' porque viene de la API de Valorant y es lento/estático
  } else {
    console.log('🛡️ Production mode detected: skipping database cleanup.');
  }
  
  console.log('🌱 Seeding data...');

  // 1. Fetch Maps from Valorant API
  console.log('🛰️ Fetching maps...');
  const response = await fetch('https://valorant-api.com/v1/maps');
  const json = await response.json();
  const mapsData = json.data;

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

  // 2. Essential Admin Data
  const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
  const hashedPassword = await bcrypt.hash(randomPassword, 10);

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

  const player = await prisma.player.upsert({
    where: { id: 1 },
    update: { teamId: team.id },
    create: {
      id: 1,
      name: 'Administrador',
      teamId: team.id,
      role: 'flex',
      avatar_color: '#FF4655',
      riot_name: 'Admin',
      riot_tag: 'VHUB',
    },
  });

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

  console.log('--------------------------------------------------');
  console.log('🚀 ADMIN ACCESS CREDENTIALS:');
  console.log(`📧 Email: admin@vhub.com`);
  console.log(`🔑 Password: ${randomPassword}`);
  console.log('--------------------------------------------------');

  console.log('✅ Team and Admin linked.');
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
