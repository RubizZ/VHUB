import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "capitan@7r.com";
  const password = "password123";
  const hashedPassword = await bcrypt.hash(password, 10);

  // 1. Buscar el equipo 7R Premier
  const team = await prisma.team.findUnique({
    where: { slug: "7r-premier" }
  });

  if (!team) {
    console.error("❌ Error: No se encontró el equipo '7r-premier'. Ejecuta primero la migración inicial.");
    return;
  }

  // 2. Crear o actualizar el usuario Team Admin
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role: "team_admin",
      teamId: team.id,
      password: hashedPassword
    },
    create: {
      email,
      name: "Capitán 7R",
      password: hashedPassword,
      role: "team_admin",
      teamId: team.id
    }
  });

  console.log(`✅ Usuario TEAM_ADMIN creado con éxito.`);
  console.log(`📧 Email: ${email}`);
  console.log(`🔑 Password: ${password}`);
  console.log(`🏢 Equipo: ${team.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
