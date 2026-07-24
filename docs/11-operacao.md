# Operação — ambientes ativos

Estado em 24/07/2026, fim da Fase 0.

---

## 1. O que está no ar

| Peça          | Onde                                              | URL                                            | Estado    |
| ------------- | ------------------------------------------------- | ---------------------------------------------- | --------- |
| Web (landing) | Vercel · `alan-araujos-projects/clashpilot`       | https://clashpilot.vercel.app                  | ✅ Ready  |
| Gateway       | Railway · projeto `ClashPilot`, serviço `gateway` | https://gateway-production-c67a.up.railway.app | ✅ Online |
| PostgreSQL    | Railway · serviço `Postgres`                      | rede privada + URL pública                     | ✅ Online |

- **Deploy automático:** todo `push` para `main` no GitHub dispara Vercel (web) e Railway (gateway).
  O Railway só reconstrói quando muda algo em `apps/gateway`, `packages/core`, `packages/coc-data`
  ou no lockfile (`watchPatterns` em `railway.toml`) — pushes só de documentação não gastam build.
- **Vercel:** Root Directory = `apps/web`, framework Next.js, região `gru1` (São Paulo).
- **Healthchecks:** `GET /health` e `GET /health/egress-ip` no gateway.
- **Worker de sync:** cron no gateway às **03:10 UTC** (`node-cron`) sincroniza todos os
  jogadores com `syncEnabled`. Gatilho manual: `POST /sync/all` (assinado). Sob demanda:
  `POST /sync/player/:id`, com throttle de 60 s. É o único escritor do histórico (ADR-001) —
  snapshot diário idempotente, diff em eventos e payload bruto arquivado em gzip.

## 2. O IP de saída do Railway **não** é fixo — medido, não suposto

Duas coisas diferentes, e só uma importa para a Supercell:

|                                          | O que é                                                 | Serve para a allowlist? |
| ---------------------------------------- | ------------------------------------------------------- | ----------------------- |
| `gateway-production-c67a.up.railway.app` | **entrada** — por onde o mundo chega no gateway         | ❌ não                  |
| IP de `GET /health/egress-ip`            | **saída** — origem de quem chama `api.clashofclans.com` | ✅ é este               |

Medição de 24/07/2026: o IP de saída era `136.107.98.164` e passou a `34.48.151.155` **sem
redeploy nosso**. Dentro de um mesmo container ele é estável; entre containers, não.
O painel de Networking do serviço não oferece _Static Outbound IP_ — só _Outbound IPv6_.

**Decisão: o gateway sai pelo proxy de IP fixo da RoyaleAPI.**

```
COC_API_BASE_URL       = https://cocproxy.royaleapi.dev/v1   (primário, IP fixo 45.79.218.79)
COC_FALLBACK_PROXY_URL = https://api.clashofclans.com/v1     (secundário, direto)
```

O proxy espelha a API 1:1 — mesmo path, mesmo header `Authorization`, mesma resposta. A chave
continua sendo **nossa**; ele só encaminha. O caminho direto fica como secundário e passa a
funcionar sozinho no dia em que houver um IP realmente estático para cadastrar (a chave aceita
até 5 CIDRs, então dá para ter os dois ao mesmo tempo).

Custos dessa escolha, explícitos:

- dependência de um terceiro sem SLA — mitigada pelo failover automático já implementado;
- **o Bearer token trafega pelo proxy** ⇒ usar uma chave **dedicada e revogável** para isso,
  nunca compartilhada com outra aplicação;
- o IP do proxy já mudou uma vez no passado (`128.128.128.128` → `45.79.218.79`), então
  `GET /health/egress-ip` e o alerta de `invalidIp` continuam sendo o instrumento de vigilância.

## 3. Variáveis configuradas

**Railway · gateway**

| Variável                      | Valor                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `PORT`                        | `4000` (fixado: o Railway injeta 8080 por padrão e o domínio aponta para 4000) |
| `NODE_ENV`                    | `production`                                                                   |
| `GATEWAY_SECRET`              | segredo HMAC de 48 caracteres, igual ao da Vercel                              |
| `COC_API_TOKEN`               | ⚠️ `pendente-aguardando-ip-fixo` — **trocar pela chave real**                  |
| `COC_API_BASE_URL`            | `https://cocproxy.royaleapi.dev/v1` (proxy de IP fixo — primário)              |
| `COC_FALLBACK_PROXY_URL`      | `https://api.clashofclans.com/v1` (direto — secundário)                        |
| `COC_RATE_LIMIT_RPS`          | `10`                                                                           |
| `DATABASE_URL` / `DIRECT_URL` | referências ao serviço `Postgres`                                              |

**Vercel · clashpilot** — `COC_GATEWAY_URL`, `COC_GATEWAY_SECRET`, `NEXT_PUBLIC_APP_URL`.

## 4. Chave da API — ✅ ativa

Chave `developer/silver` com allowlist `45.79.218.79`, aplicada em `COC_API_TOKEN` no serviço
`gateway`. Validada ponta a ponta em 24/07/2026:

```
GET /players/%232PP  →  200
Morgil #2PP · TH8 · 30 unidades · 54 achievements
escopos: { home: 46, builderBase: 6, clanCapital: 2 }
```

O caminho completo funciona: Vercel → HMAC → gateway → proxy de IP fixo → Supercell → zod →
domínio normalizado.

**Prova direta do ADR-006 nesse mesmo payload:** `Barbarian level 5, globalMaxLevel 13` numa
conta TH8. O `maxLevel` da API é o máximo do jogo, não o do TH — usá-lo como denominador
mostraria 38% para uma vila que pode estar no máximo do TH8.

Rotação: a chave é dedicada e revogável no portal. Trocar é
`railway variables --service gateway --set "COC_API_TOKEN=<nova>"` — nada mais no sistema a conhece.

## 5. Armadilhas já encontradas (para não repetir)

| Sintoma                                                              | Causa                                                                  | Correção aplicada                                                                            |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `ERR_MODULE_NOT_FOUND: packages/core/src/shared/result.js`           | tsup deixou os pacotes do workspace como externos; eles são TS cru     | `noExternal: [/^@clashpilot\//]` em `tsup.config.ts`                                         |
| Healthcheck falha, app "Online" mas `502`                            | Railway injeta `PORT=8080`; o domínio apontava para 4000               | `PORT=4000` fixado como variável                                                             |
| `TypeError: Invalid URL` no build do Next                            | PowerShell escreveu BOM no início da variável na Vercel                | `apps/web/src/lib/env.ts` sanitiza e cai no padrão; coberto por teste                        |
| `No Next.js version detected`                                        | Root Directory da Vercel apontava para a raiz do monorepo              | Root Directory = `apps/web`, build em auto-detecção                                          |
| `401 assinatura inválida` em todo GET                                | `JSON.stringify(undefined ?? "")` devolve `'""'`, não `''`             | `canonicalBody()` compartilhada + teste de regressão                                         |
| `badSchema: village 'clanCapital'`                                   | escopo de achievement não documentado em lugar nenhum                  | `AchievementScope` com degradação para `other`                                               |
| `Module not found: './townhall.js'` só no build de produção          | webpack não mapeia `.js` → `.ts`; turbopack e tsc mapeiam              | `extensionAlias` no `next.config.ts`                                                         |
| `PrismaClientInitializationError` em produção, verde local           | com pnpm isolado o engine nativo do Prisma não é copiado para a função | Prisma sem engine: `engineType = "client"` + driver adapter `pg`                             |
| `403 MISSING_OR_NULL_ORIGIN`                                         | proteção CSRF do Better Auth (comportamento correto)                   | nada a corrigir — o teste automatizado passou a enviar `Origin`                              |
| Gateway sobe e morre: `Dynamic require of "events" is not supported` | tsup embutiu `pg` (CommonJS com require nativo) no bundle ESM          | `external: ["pg", "@prisma/adapter-pg", "@prisma/client"]` no tsup + deps diretas do gateway |
| `FST_ERR_CTP_EMPTY_JSON_BODY` ao chamar `/sync/all`                  | POST vazio com `Content-Type: application/json`                        | não é bug — enviar sem content-type; a assinatura cobre corpo vazio                          |
