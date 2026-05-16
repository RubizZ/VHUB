import { execSync } from "child_process";

const DB_USER = "postgres.zwjoqlaipvxfhiaxebkg";
const DB_PASS = "i96KOvwLmnDW9Aj5";
const DB_HOST = "aws-0-eu-west-1.pooler.supabase.com";
const DB_PORT = "5432";
const DB_NAME = "postgres";

const encodedPass = encodeURIComponent(DB_PASS);
const databaseUrl = `postgresql://${DB_USER}:${encodedPass}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;

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
