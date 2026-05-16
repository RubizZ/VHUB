import "dotenv/config";
import { defineConfig } from "prisma/config";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// 1. Prioridad absoluta a nuestra variable espejo con esteroides SSL de Vercel
let databaseUrl =
    process.env["DATABASE_URL_WITH_SSL"] || process.env["DATABASE_URL"];

// 2. Si no existen, es que estamos en el flujo de inicialización/integración estándar de Vercel
if (!databaseUrl) {
    const isPrismaCLI = process.argv.some(
        (arg) =>
            arg.includes("prisma") ||
            arg.includes("db") ||
            arg.includes("migrate"),
    );

    databaseUrl = isPrismaCLI
        ? (process.env["POSTGRES_URL_NON_POOLING"] ??
          process.env["POSTGRES_PRISMA_URL"])
        : (process.env["POSTGRES_PRISMA_URL"] ??
          process.env["POSTGRES_URL_NON_POOLING"]);
}

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
        seed: "npx tsx prisma/seed.ts",
    },
    datasource: {
        url: databaseUrl,
    },
});
