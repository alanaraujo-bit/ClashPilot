import { z } from "zod";

/**
 * DTOs — o shape EXATO da Supercell, validado na borda.
 *
 * Nada daqui vaza para o domínio: `mapper.ts` converte para os tipos de `@clashpilot/core`.
 * Campos que a API pode omitir são opcionais de verdade — assumir presença é o que quebra
 * o app quando o jogador ainda não desbloqueou um herói.
 */

const iconUrls = z
  .object({
    small: z.string().optional(),
    medium: z.string().optional(),
    large: z.string().optional(),
  })
  .partial();

export const unitDto = z.object({
  name: z.string(),
  level: z.number().int().nonnegative(),
  /** Máximo GLOBAL do jogo — NÃO é o máximo do TH atual. Ver ADR-006. */
  maxLevel: z.number().int().nonnegative(),
  village: z.enum(["home", "builderBase"]),
  superTroopIsActive: z.boolean().optional(),
});

export const heroEquipmentDto = z.object({
  name: z.string(),
  level: z.number().int().nonnegative(),
  maxLevel: z.number().int().nonnegative(),
  village: z.enum(["home", "builderBase"]).optional(),
});

export const heroDto = unitDto.extend({
  equipment: z.array(heroEquipmentDto).optional(),
});

export const achievementDto = z.object({
  name: z.string(),
  stars: z.number().int(),
  value: z.number(),
  target: z.number(),
  info: z.string().optional(),
  completionInfo: z.string().nullable().optional(),
  village: z.enum(["home", "builderBase"]),
});

export const playerDto = z.object({
  tag: z.string(),
  name: z.string(),
  townHallLevel: z.number().int().positive(),
  townHallWeaponLevel: z.number().int().optional(),
  expLevel: z.number().int().nonnegative(),
  trophies: z.number().int(),
  bestTrophies: z.number().int(),
  warStars: z.number().int().default(0),
  attackWins: z.number().int().default(0),
  defenseWins: z.number().int().default(0),
  donations: z.number().int().default(0),
  donationsReceived: z.number().int().default(0),
  clanCapitalContributions: z.number().default(0),
  builderHallLevel: z.number().int().optional(),
  builderBaseTrophies: z.number().int().optional(),
  role: z.string().optional(),
  warPreference: z.enum(["in", "out"]).optional(),
  league: z.object({ id: z.number(), name: z.string(), iconUrls: iconUrls.optional() }).optional(),
  clan: z
    .object({
      tag: z.string(),
      name: z.string(),
      clanLevel: z.number().int(),
      badgeUrls: iconUrls.optional(),
    })
    .optional(),
  achievements: z.array(achievementDto).default([]),
  troops: z.array(unitDto).default([]),
  spells: z.array(unitDto).default([]),
  heroes: z.array(heroDto).default([]),
  heroEquipment: z.array(heroEquipmentDto).default([]),
});

export type PlayerDto = z.infer<typeof playerDto>;

export const verifyTokenDto = z.object({
  tag: z.string(),
  token: z.string(),
  status: z.enum(["ok", "invalid"]),
});

export const cocErrorDto = z.object({
  reason: z.string(),
  message: z.string().optional(),
  type: z.string().optional(),
  detail: z.unknown().optional(),
});
