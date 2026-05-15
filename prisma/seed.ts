import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as bcrypt from 'bcryptjs';

// Initialize Prisma with the Driver Adapter for PostgreSQL
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Clean existing data (carefully)
  await prisma.availability.deleteMany();
  await prisma.message.deleteMany();
  await prisma.strategy.deleteMany();
  await prisma.composition.deleteMany();
  await prisma.matchPlayerStats.deleteMany();
  await prisma.match.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.map.deleteMany();

  console.log('🧹 Database cleaned.');

  // 2. Create Main Team
  const team7R = await prisma.team.create({
    data: {
      name: 'SevenR Premier',
      slug: '7r-premier',
      logo_url: 'https://utfs.io/f/8e8d8a7c-6e6e-4e8e-8e8e-8e8e8e8e8e8e-7r.png',
    },
  });

  console.log('✅ Team created.');

  // 3. Create Maps
  const maps = [
    { id: '7eaecc1b-4337-bbf6-6130-0383b7b066fe', name: 'Ascent' },
    { id: '2c9dbf58-4130-8d5c-9c71-29a997380962', name: 'Bind' },
    { id: '2fb9a4ff-437c-52c1-b9a3-0a35a6bc341c', name: 'Breeze' },
    { id: 'cc8b6908-419b-a91d-09ad-da9a3c9044d3', name: 'Fracture' },
    { id: 'fd2697a1-4a91-9370-c9c1-1e94119d675b', name: 'Haven' },
    { id: 'e2ad30e4-4140-0772-1308-319ef72535d0', name: 'Icebox' },
    { id: '22283aeb-4c80-a704-219d-768a4a51916e', name: 'Lotus' },
    { id: '6f2a4076-4172-8703-9e19-94813f38006d', name: 'Pearl' },
    { id: '320b2a48-4d2b-d13d-bc88-829910d64479', name: 'Split' },
    { id: '12401c44-4155-b3e8-1c4b-32bc21e75e92', name: 'Sunset' },
    { id: '2bee0dc9-4ffe-519b-1ccd-7d116374d2fe', name: 'Abyss' },
  ];

  for (const map of maps) {
    await prisma.map.create({ data: map });
  }

  console.log('✅ Maps created.');

  // 4. Create ONLY the Main Admin User/Player
  const hashedPassword = await bcrypt.hash('vhub_pass', 10);

  const player = await prisma.player.create({
    data: {
      name: 'Rubén',
      riot_name: 'Ruben',
      riot_tag: 'VHUB',
      role: 'duelist',
      avatar_color: '#FF4655',
      teamId: team7R.id,
    },
  });

  await prisma.user.create({
    data: {
      name: 'Rubén',
      email: 'admin@vhub.com',
      password: hashedPassword,
      role: 'super_admin', // Super admin has team admin permissions in the code
      teamId: team7R.id,
      playerId: player.id,
    },
  });

  console.log('✅ Admin user created.');

  // 5. Create some initial events
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  await prisma.event.create({
    data: {
      teamId: team7R.id,
      title: 'Práctica Táctica - Ascent',
      type: 'practice',
      date: nextWeek.toISOString().split('T')[0],
      time: '21:00',
      map: 'Ascent',
      description: 'Revisión de ejecuciones en el sitio de A.',
      status: 'scheduled',
    },
  });

  console.log('✅ Initial events created.');
  console.log('🚀 Seed finished successfully!');
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
