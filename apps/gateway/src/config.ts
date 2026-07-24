import { z } from "zod";

/**
 * Configuração validada na inicialização. Se faltar variável, o processo morre agora com
 * mensagem clara — em vez de dar 500 no primeiro usuário.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),

  /** Token da Supercell. Só existe aqui — nunca na Vercel. */
  COC_API_TOKEN: z.string().min(1, "COC_API_TOKEN é obrigatório"),
  COC_API_BASE_URL: z.string().url().default("https://api.clashofclans.com/v1"),
  /** Proxy comunitário de IP fixo, usado como degradação se a chamada direta falhar (ADR-001). */
  COC_FALLBACK_PROXY_URL: z.string().url().optional(),

  /** Segredo HMAC compartilhado com apps/web. */
  GATEWAY_SECRET: z.string().min(16, "GATEWAY_SECRET precisa de pelo menos 16 caracteres"),

  /** Token bucket: requisições por segundo contra a API oficial. */
  COC_RATE_LIMIT_RPS: z.coerce.number().positive().default(10),
  COC_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
});

export type GatewayConfig = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Configuração inválida do gateway:\n${issues.join("\n")}`);
  }
  return parsed.data;
}
