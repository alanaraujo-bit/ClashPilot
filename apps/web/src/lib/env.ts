const FALLBACK_APP_URL = "https://clashpilot.vercel.app";

/**
 * Variáveis de ambiente vindas de painéis (Vercel, Railway) chegam com surpresas: espaço
 * no fim, quebra de linha, BOM colado pelo terminal de quem cadastrou. Uma URL inválida aqui
 * derruba o build inteiro do Next em `metadataBase` — então sanitiza e cai no padrão.
 */
function cleanEnv(value: string | undefined): string | undefined {
  const trimmed = value?.replace(/^﻿/, "").trim();
  return trimmed !== undefined && trimmed.length > 0 ? trimmed : undefined;
}

function safeUrl(value: string | undefined, fallback: string): string {
  const candidate = cleanEnv(value);
  if (candidate === undefined) return fallback;
  try {
    return new URL(candidate).toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

export const appUrl = safeUrl(process.env["NEXT_PUBLIC_APP_URL"], FALLBACK_APP_URL);

export const gatewayUrl = safeUrl(process.env["COC_GATEWAY_URL"], "http://localhost:4000");
