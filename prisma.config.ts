import "dotenv/config";
import { defineConfig } from "prisma/config";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

let databaseUrl = process.env["DATABASE_URL"];

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

// ✅ LA SOLUCIÓN LIMPIA: Inyectar los parámetros SSL solo si estamos en producción
// y el string es una URL real válida de Supabase
if (databaseUrl && process.env.NODE_ENV === "production") {
    const sslParams = "sslmode=require&sslaccept=accept_invalid_certs";
    databaseUrl = databaseUrl.includes("?")
        ? `${databaseUrl}&${sslParams}`
        : `${databaseUrl}?${sslParams}`;
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
