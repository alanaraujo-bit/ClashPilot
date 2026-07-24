import { describe, expect, it } from "vitest";
import { type PlayerTag, describeTagError, parsePlayerTag, toApiPath } from "./player-tag.js";

const expectOk = (input: string): PlayerTag => {
  const r = parsePlayerTag(input);
  if (!r.ok) throw new Error(`esperava sucesso para "${input}", veio ${r.error.kind}`);
  return r.value;
};

describe("parsePlayerTag", () => {
  it("normaliza caixa, espaços, hífen e # inicial", () => {
    expect(expectOk("  #2pp ")).toBe("#2PP");
    expect(expectOk("2pp")).toBe("#2PP");
    expect(expectOk("#2P-P")).toBe("#2PP");
  });

  it('troca "O" por zero — o alfabeto da Supercell não tem a letra O', () => {
    expect(expectOk("#2OO")).toBe("#200");
  });

  it("rejeita caracteres fora do alfabeto, listando quais", () => {
    const r = parsePlayerTag("#ABZ");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe("invalidChars");
    if (r.error.kind !== "invalidChars") return;
    expect(r.error.chars).toEqual(["A", "B", "Z"]);
    expect(describeTagError(r.error)).toContain("A, B, Z");
  });

  it("rejeita vazio, curto demais e longo demais", () => {
    expect(parsePlayerTag("   ").ok).toBe(false);
    expect(parsePlayerTag("#2P").ok).toBe(false);
    expect(parsePlayerTag("#222222222222222").ok).toBe(false);
  });

  it("gera o caminho da API com # escapado", () => {
    expect(toApiPath(expectOk("#2PP"))).toBe("%232PP");
  });

  it("toda mensagem de erro é humana e em pt-BR", () => {
    for (const input of ["", "#2P", "#222222222222222", "#ABZ"]) {
      const r = parsePlayerTag(input);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(describeTagError(r.error).length).toBeGreaterThan(10);
    }
  });
});
