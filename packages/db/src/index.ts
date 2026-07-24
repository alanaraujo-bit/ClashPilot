import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client/client.js";

export * from "../generated/client/client.js";

/**
 * Client sem engine nativo (ver `schema.prisma`): a conexão vai pelo driver `pg` através de
 * um Driver Adapter, e o client gerado é JavaScript puro.
 *
 * Instância única: em dev o HMR do Next recria módulos a cada save e, sem o cache global,
 * o pool de conexões estoura em poucos minutos.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL não configurada — o client do Prisma não pode ser criado.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env["NODE_ENV"] === "development" ? ["query", "warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = prisma;
}
