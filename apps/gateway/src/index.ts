import Fastify from "fastify";
import { parsePlayerTag } from "@clashpilot/core";
import { z } from "zod";
import { CocApiClient } from "./coc/client.js";
import { loadConfig } from "./config.js";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verify } from "./http/hmac.js";

const config = loadConfig();
const coc = new CocApiClient(config);

const app = Fastify({
  logger: {
    level: config.NODE_ENV === "production" ? "info" : "debug",
    // Nunca logar Authorization: o token da Supercell é o segredo mais sensível do sistema.
    redact: ["req.headers.authorization", `req.headers.${SIGNATURE_HEADER}`],
  },
});

/** Status HTTP por tipo de erro de domínio — sem `any`, sem `switch` espalhado pelas rotas. */
const STATUS_BY_ERROR = {
  notFound: 404,
  throttled: 429,
  maintenance: 503,
  invalidIp: 502,
  unauthorized: 502,
  network: 502,
  badSchema: 502,
} as const;

app.get("/health", async () => ({
  status: "ok",
  uptimeSec: Math.round(process.uptime()),
  version: process.env["RAILWAY_GIT_COMMIT_SHA"] ?? "dev",
}));

/** Diagnóstico do IP de saída — é este endereço que precisa estar na allowlist da chave. */
app.get("/health/egress-ip", async (_req, reply) => {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    return await res.json();
  } catch {
    return reply.code(502).send({ error: "não foi possível determinar o IP de saída" });
  }
});

app.addHook("preHandler", async (req, reply) => {
  if (req.url.startsWith("/health")) return;

  const result = verify({
    secret: config.GATEWAY_SECRET,
    signature: req.headers[SIGNATURE_HEADER] as string | undefined,
    timestamp: req.headers[TIMESTAMP_HEADER] as string | undefined,
    method: req.method,
    path: req.url,
    body: typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? ""),
  });

  if (!result.ok) {
    req.log.warn({ reason: result.reason }, "assinatura HMAC rejeitada");
    return reply.code(401).send({ error: "assinatura inválida", reason: result.reason });
  }
});

app.get("/players/:tag", async (req, reply) => {
  const params = z.object({ tag: z.string() }).parse(req.params);
  const tag = parsePlayerTag(params.tag);
  if (!tag.ok) return reply.code(400).send({ error: "tag inválida", detail: tag.error });

  const result = await coc.getPlayer(tag.value);
  if (!result.ok)
    return reply.code(STATUS_BY_ERROR[result.error.kind]).send({ error: result.error });

  return result.value;
});

app.post("/players/:tag/verify", async (req, reply) => {
  const params = z.object({ tag: z.string() }).parse(req.params);
  const body = z.object({ token: z.string().min(1) }).safeParse(req.body);
  if (!body.success) return reply.code(400).send({ error: "token ausente" });

  const tag = parsePlayerTag(params.tag);
  if (!tag.ok) return reply.code(400).send({ error: "tag inválida", detail: tag.error });

  const result = await coc.verifyPlayerToken(tag.value, body.data.token);
  if (!result.ok)
    return reply.code(STATUS_BY_ERROR[result.error.kind]).send({ error: result.error });

  return { verified: result.value };
});

try {
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
