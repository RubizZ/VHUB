import "dotenv/config";
import { defineConfig } from "prisma/config";
import * as dotenv from "dotenv";
import path from "path";

// Forzamos a dotenv a cargar el archivo .env de la raíz en local por si la CLI se despista
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// 1. Comprobamos primero si tenemos la variable local clásica (Desarrollo)
let databaseUrl = process.env["DATABASE_URL"];

// 2. Si no existe DATABASE_URL, significa que estamos en Vercel (Producción)
if (!databaseUrl) {
  const isPrismaCLI = process.argv.some(
    (arg) => arg.includes("prisma") || arg.includes("db") || arg.includes("migrate")
  );

  databaseUrl = isPrismaCLI
    ? (process.env["POSTGRES_URL_NON_POOLING"] ?? process.env["POSTGRES_PRISMA_URL"])
    : (process.env["POSTGRES_PRISMA_URL"] ?? process.env["POSTGRES_URL_NON_POOLING"]);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: 'npx tsx prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl,
  },
});