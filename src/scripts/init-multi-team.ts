import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Iniciando migración Multi-Equipo...");

  // 1. Crear equipo fundacional
  const team = await prisma.team.upsert({
    where: { slug: "7r-premier" },
    update: {},
    create: {
      name: "7R Premier",
      slug: "7r-premier",
    },
  });

  console.log(`✅ Equipo '${team.name}' (ID: ${team.id}) creado/verificado.`);

  // 2. Migrar Usuarios
  const users = await prisma.user.updateMany({
    where: { teamId: null },
    data: { teamId: team.id },
  });
  console.log(`✅ ${users.count} usuarios vinculados al equipo.`);

  // 3. Migrar Jugadores
  const players = await prisma.player.updateMany({
    where: { teamId: null },
    data: { teamId: team.id },
  });
  console.log(`✅ ${players.count} jugadores vinculados al equipo.`);

  // 4. Migrar Eventos
  const events = await prisma.event.updateMany({
    where: { teamId: null },
    data: { teamId: team.id },
  });
  console.log(`✅ ${events.count} eventos vinculados al equipo.`);

  // 5. Migrar Mensajes de Chat
  const messages = await prisma.message.updateMany({
    where: { teamId: null },
    data: { teamId: team.id },
  });
  console.log(`✅ ${messages.count} mensajes de chat vinculados al equipo.`);

  // 6. Migrar Composiciones y Estrategias
  const comps = await prisma.composition.updateMany({
    where: { teamId: null },
    data: { teamId: team.id },
  });
  console.log(`✅ ${comps.count} composiciones vinculadas al equipo.`);

  // 7. Migrar Partidas
  const matches = await prisma.match.updateMany({
    where: { teamId: null },
    data: { teamId: team.id },
  });
  console.log(`✅ ${matches.count} partidas vinculadas al equipo.`);

  // 8. Elevar al primer usuario a super_admin (Opcional, pero recomendado)
  const firstAdmin = await prisma.user.findFirst({
    where: { role: "admin" }
  });

  if (firstAdmin) {
    await prisma.user.update({
      where: { id: firstAdmin.id },
      data: { role: "super_admin" }
    });
    console.log(`👑 Usuario ${firstAdmin.email} elevado a SUPER_ADMIN.`);
  }

  console.log("🏁 Migración completada con éxito.");
}

main()
  .catch((e) => {
    console.error("❌ Error en la migración:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
