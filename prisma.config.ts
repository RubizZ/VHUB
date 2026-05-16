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

// ✅ CONFIGURACIÓN TLS ADAPTADA AL LOG DE ERROR
const isLocalDb = !databaseUrl || databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1") || databaseUrl.includes("@db:");
if (databaseUrl && (process.env.NODE_ENV === "production" || !isLocalDb)) {
    // 1. uselibpqcompat=true -> Activa la compatibilidad estándar de Postgres y evita que Node fuerce 'verify-full'
    // 2. sslmode=require     -> Fuerza cifrado TLS
    // 3. sslaccept=accept_invalid_certs -> Permite el certificado del pooler de Supabase
    const sslParams =
        "uselibpqcompat=true&sslmode=require&sslaccept=accept_invalid_certs";

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
