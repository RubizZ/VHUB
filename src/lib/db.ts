import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import "dotenv/config"; // Nos aseguramos de que lea el .env local en desarrollo

// Lógica para obtener la URL correcta en cualquier entorno
const getDatabaseUrl = () => {
  // 1. Si estás en local trabajando, usará tu DATABASE_URL tradicional
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  // 2. Si estás en Vercel, discrimina según si es la CLI (build) o la app corriendo
  const isPrismaCLI = process.argv.some(
    (arg) => arg.includes("prisma") || arg.includes("db") || arg.includes("migrate")
  );

  return isPrismaCLI
    ? (process.env["POSTGRES_URL_NON_POOLING"] ?? process.env["POSTGRES_PRISMA_URL"])
    : (process.env["POSTGRES_PRISMA_URL"] ?? process.env["POSTGRES_URL_NON_POOLING"]);
};

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: pg.Pool | undefined;
};

const pool = globalForPrisma.pool ?? new pg.Pool({ connectionString: getDatabaseUrl() });
if (process.env.NODE_ENV !== 'production') globalForPrisma.pool = pool;

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export const db = prisma;
export const dbReady = Promise.resolve();

export async function withTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}