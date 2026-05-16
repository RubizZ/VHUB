import { execSync } from "child_process";
import { loadEnvConfig } from "@next/env";

// Load environment variables from .env / .env.local
loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL_PROD;

if (!databaseUrl) {
    console.error("❌ Error: DATABASE_URL_PROD must be defined in your .env file.");
    process.exit(1);
}

console.log("🛡️  Iniciando seeding directo en PRODUCCIÓN...");

try {
    execSync("npx tsx prisma/seed.ts", {
        stdio: "inherit",
        env: {
            ...process.env,
            NODE_ENV: "production",
            DATABASE_URL: databaseUrl,
        },
    });
} catch (error) {
    console.error("❌ Error: El proceso de seeding ha fallado.");
    process.exit(1);
}
