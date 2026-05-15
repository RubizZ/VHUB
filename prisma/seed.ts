import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as bcrypt from 'bcryptjs';
import { ValorantApi } from '@valpro-labs/valorant-api';

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
  const valorantApi = new ValorantApi({ language: 'es-ES' });
  const mapsData = await valorantApi.mapsEndpoints.getMapsV1();

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

  const riotName = 'Rubiz';
  const riotTag = '000';
  let puuid = null;

  console.log(`🛰️ Fetching PUUID for ${riotName}#${riotTag}...`);
  try {
    const henrikRes = await fetch(`https://api.henrikdev.xyz/valorant/v1/account/${riotName}/${riotTag}`, {
      headers: { 'Authorization': process.env.HENRIK_API_KEY || '' }
    });
    const henrikData = await henrikRes.json();
    if (henrikRes.ok && henrikData.data) {
      puuid = henrikData.data.puuid;
      console.log(`✅ Found PUUID: ${puuid}`);
    } else {
      console.warn(`⚠️ Could not fetch PUUID for ${riotName}#${riotTag}: ${henrikData.message || 'Unknown error'}`);
    }
  } catch (err) {
    console.warn(`⚠️ Error connecting to HenrikDev API:`, err);
  }

  const team = await prisma.team.upsert({
    where: { slug: 'vhub-elite' },
    update: {},
    create: {
      name: 'V-HUB Elite',
      slug: 'vhub-elite',
      logo_url: '/logo.png',
      inviteCode: 'VHUB-JOIN-2026',
      conference: 'EU_IBIT',
      matchHistoryConsent: true,
    },
  });

  const player = await prisma.player.upsert({
    where: { id: 1 },
    update: { 
      teamId: team.id,
      puuid,
      riot_name: riotName,
      riot_tag: riotTag,
    },
    create: {
      id: 1,
      name: 'Administrador',
      teamId: team.id,
      role: 'flex',
      avatar_color: '#FF4655',
      riot_name: riotName,
      riot_tag: riotTag,
      puuid,
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@vhub.com' },
    update: {
      teamId: team.id,
      playerId: player.id,
      dataConsent: true,
    },
    create: {
      name: 'Administrador',
      email: 'admin@vhub.com',
      password: hashedPassword,
      role: 'super_admin',
      teamId: team.id,
      playerId: player.id,
      dataConsent: true,
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
