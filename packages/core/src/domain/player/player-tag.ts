import { type Result, err, ok } from "../../shared/result.js";

/**
 * Value Object da tag de jogador/clã.
 *
 * A Supercell usa um alfabeto restrito de 14 caracteres. Letras ambíguas não existem nele:
 * o usuário lê "O" mas o valor correto é "0", e "I" é "1". Normalizar isso aqui elimina a
 * causa nº 1 de "jogador não encontrado" no onboarding.
 */
const TAG_ALPHABET = "0289PYLQGRJCUV";
/** O alfabeto não tem "O" — o que parece um "ó" é sempre zero. É a única troca segura. */
const AMBIGUOUS: ReadonlyMap<string, string> = new Map([["O", "0"]]);

export type PlayerTagError =
  | { readonly kind: "empty" }
  | { readonly kind: "tooShort"; readonly length: number }
  | { readonly kind: "tooLong"; readonly length: number }
  | { readonly kind: "invalidChars"; readonly chars: readonly string[] };

declare const brand: unique symbol;
/** String garantidamente normalizada e válida. Não é construível sem passar por `parsePlayerTag`. */
export type PlayerTag = string & { readonly [brand]: "PlayerTag" };

const MIN_LENGTH = 3;
const MAX_LENGTH = 12;

export function parsePlayerTag(input: string): Result<PlayerTag, PlayerTagError> {
  const cleaned = input.trim().toUpperCase().replace(/^#/, "").replace(/[\s-]/g, "");

  if (cleaned.length === 0) return err({ kind: "empty" });

  const normalized = [...cleaned].map((c) => AMBIGUOUS.get(c) ?? c).join("");

  if (normalized.length < MIN_LENGTH) return err({ kind: "tooShort", length: normalized.length });
  if (normalized.length > MAX_LENGTH) return err({ kind: "tooLong", length: normalized.length });

  const invalid = [...new Set([...normalized].filter((c) => !TAG_ALPHABET.includes(c)))];
  if (invalid.length > 0) return err({ kind: "invalidChars", chars: invalid });

  return ok(`#${normalized}` as PlayerTag);
}

/** Forma para URL da API oficial: `#` vira `%23`. */
export function toApiPath(tag: PlayerTag): string {
  return encodeURIComponent(tag);
}

export function describeTagError(error: PlayerTagError): string {
  switch (error.kind) {
    case "empty":
      return "Digite a tag do jogador.";
    case "tooShort":
      return "Tag muito curta — ela tem pelo menos 3 caracteres depois do #.";
    case "tooLong":
      return "Tag muito longa — confira se não sobrou algum caractere.";
    case "invalidChars":
      return `Esses caracteres não existem em uma tag: ${error.chars.join(", ")}.`;
  }
}
