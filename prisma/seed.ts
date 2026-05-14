import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create Maps
  const maps = [
    { id: '7eaecc1b-4337-bbf6-6ab9-04b8f06b3319', name: 'Ascent' },
    { id: 'd960549e-485c-e861-8d71-aa9d1aed12a2', name: 'Split' },
    { id: 'b529448b-4d60-346e-e89e-00a4c527a405', name: 'Fracture' },
    { id: '2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba', name: 'Bind' },
    { id: '2fb9a4fd-47b8-4e7d-a969-74b4046ebd53', name: 'Breeze' },
    { id: '2fe4ed3a-450a-948b-6d6b-e89a78e680a9', name: 'Lotus' },
    { id: 'fd267378-4d1d-484f-ff52-77821ed10dc2', name: 'Pearl' },
    { id: '2bee0dc9-4ffe-519b-1cbd-7fbe763a6047', name: 'Haven' },
    { id: 'e2ad30e6-4c11-1f1a-7b36-119569382091', name: 'Icebox' },
    { id: '22697a3d-45bf-8dd7-4f4a-9b973b13199b', name: 'Abyss' },
    { id: '12452a9d-48c3-0202-3159-4581967cb302', name: 'Sunset' },
  ];

  for (const m of maps) {
    await prisma.map.upsert({
      where: { id: m.id },
      update: {},
      create: m,
    });
  }

  // 2. Create Players & Users
  const players = [
    { name: 'Rubén', riot_name: 'Ruben', riot_tag: '7R', role: 'duelist', avatar_color: '#FF4655', email: 'admin@7r.com' },
    { name: 'Alex', riot_name: 'Alex', riot_tag: '7R', role: 'initiator', avatar_color: '#00D4AA', email: 'alex@7r.com' },
    { name: 'Dani', riot_name: 'Dani', riot_tag: '7R', role: 'controller', avatar_color: '#A855F7', email: 'dani@7r.com' },
    { name: 'Marc', riot_name: 'Marc', riot_tag: '7R', role: 'sentinel', avatar_color: '#3B82F6', email: 'marc@7r.com' },
    { name: 'Pol', riot_name: 'Pol', riot_tag: '7R', role: 'flex', avatar_color: '#F59E0B', email: 'pol@7r.com' },
  ];

  const hashedPassword = await bcrypt.hash('sevenr_pass', 10);

  for (const pData of players) {
    const { email, ...p } = pData;
    const player = await prisma.player.create({
      data: p,
    });

    await prisma.user.create({
      data: {
        name: player.name,
        email: email,
        password: hashedPassword,
        role: email === 'admin@7r.com' ? 'admin' : 'member',
        playerId: player.id
      }
    });
  }

  // 3. Create initial events
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  await prisma.event.create({
    data: {
      title: 'Práctica Semanal',
      type: 'practice',
      date: today,
      time: '21:00',
      description: 'Entrenamiento de tácticas en Ascent',
      map: 'Ascent',
    }
  });

  await prisma.event.create({
    data: {
      title: 'Partido Premier #1',
      type: 'match',
      date: tomorrow,
      time: '20:00',
      description: 'Primer partido de la temporada',
      premier_week: 1,
    }
  });

  console.log('Seed completed successfully!');
  console.log('Admin user: admin@7r.com / sevenr_pass');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
