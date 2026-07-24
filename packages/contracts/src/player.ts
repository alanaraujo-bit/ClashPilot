import { z } from "zod";

/**
 * Contrato de resposta do gateway. `apps/web` valida contra isto — o gateway é nosso, mas
 * uma versão antiga em produção durante um deploy é exatamente o tipo de coisa que essa
 * validação pega cedo.
 */

export const unitSchema = z.object({
  key: z.string(),
  name: z.string(),
  level: z.number().int().nonnegative(),
  count: z.number().int().positive().optional(),
  category: z.enum([
    "troop",
    "spell",
    "hero",
    "pet",
    "equipment",
    "siege",
    "building",
    "wall",
    "trap",
  ]),
  village: z.enum(["home", "builderBase"]),
  globalMaxLevel: z.number().int().nonnegative(),
  superTroopActive: z.boolean().optional(),
});

export const achievementSchema = z.object({
  name: z.string(),
  stars: z.number().int(),
  value: z.number(),
  target: z.number(),
  scope: z.enum(["home", "builderBase", "clanCapital", "other"]),
});

export const playerProfileSchema = z.object({
  tag: z.string(),
  name: z.string(),
  townHallLevel: z.number().int().positive(),
  townHallWeaponLevel: z.number().int().optional(),
  expLevel: z.number().int().nonnegative(),
  trophies: z.number().int(),
  bestTrophies: z.number().int(),
  warStars: z.number().int(),
  attackWins: z.number().int(),
  defenseWins: z.number().int(),
  donations: z.number().int(),
  donationsReceived: z.number().int(),
  clanCapitalContributions: z.number(),
  builderHallLevel: z.number().int().optional(),
  builderBaseTrophies: z.number().int().optional(),
  league: z.object({ id: z.number(), name: z.string(), iconUrl: z.string().optional() }).optional(),
  clan: z
    .object({
      tag: z.string(),
      name: z.string(),
      level: z.number().int(),
      badgeUrl: z.string().optional(),
    })
    .optional(),
  units: z.array(unitSchema),
  achievements: z.array(achievementSchema),
});

export type PlayerProfileDto = z.infer<typeof playerProfileSchema>;

export const verifyResponseSchema = z.object({ verified: z.boolean() });

export const gatewayErrorSchema = z.object({
  error: z.union([
    z.string(),
    z.object({ kind: z.string(), retryAfterMs: z.number().optional() }).passthrough(),
  ]),
});
