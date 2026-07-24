import { describe, expect, it } from "vitest";
import { appUrl, gatewayUrl } from "./env.js";

/**
 * Regressão: um BOM colado numa variável do painel da Vercel derrubou o build inteiro
 * ("Invalid URL" em metadataBase). O sanitizador existe para isso não se repetir.
 */
describe("env do app", () => {
  it("expõe URLs absolutas e válidas", () => {
    expect(() => new URL(appUrl)).not.toThrow();
    expect(() => new URL(gatewayUrl)).not.toThrow();
  });

  it("nunca termina com barra", () => {
    expect(appUrl.endsWith("/")).toBe(false);
    expect(gatewayUrl.endsWith("/")).toBe(false);
  });
});
