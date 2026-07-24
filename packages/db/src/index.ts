import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

/**
 * Instância única. Em dev o HMR do Next recria módulos a cada save; sem o cache global
 * o pool de conexões estoura em poucos minutos.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env["NODE_ENV"] === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = prisma;
}
