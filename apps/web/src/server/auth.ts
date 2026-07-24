import { prisma } from "@clashpilot/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

/**
 * Better Auth (ADR-002).
 *
 * Sessões vivem no banco e são revogáveis de verdade — requisito de `docs/04-auth.md`.
 * A identidade do ClashPilot é separada da identidade do jogo: vincular uma vila é um
 * segundo passo, provado por `/players/{tag}/verifytoken`.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env["BETTER_AUTH_SECRET"] ?? "",
  baseURL: process.env["BETTER_AUTH_URL"] ?? process.env["NEXT_PUBLIC_APP_URL"] ?? "",

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    // Verificação de e-mail entra junto com o provedor de envio (Fase 8, com o push).
    requireEmailVerification: false,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  advanced: {
    cookiePrefix: "clashpilot",
    useSecureCookies: process.env["NODE_ENV"] === "production",
  },

  // Precisa ser o último plugin: é ele que grava o cookie a partir de Server Actions.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
