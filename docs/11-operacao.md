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

## 2. ⚠️ O IP de saída do gateway ainda não é garantidamente fixo

IP observado hoje: **`136.107.98.164`**.

Esse é o endereço que precisa entrar na allowlist da chave da API do Clash of Clans. **Porém**,
por padrão o Railway não garante IP de saída estável entre redeploys — isso é um recurso
(_Static Outbound IPs_) que depende do plano. Se o IP mudar, toda chamada à API passa a
devolver `403 accessDenied.invalidIp`.

Antes de gerar a chave definitiva, fazer **um** destes:

1. Habilitar _Static Outbound IP_ no serviço `gateway` (painel do Railway → Settings → Networking)
   e usar o IP que ele fixar; **ou**
2. Cadastrar na chave o IP do proxy comunitário `cocproxy.royaleapi.dev` (`45.79.218.79`)
   e deixar todo o tráfego sair por ele — já está configurado em `COC_FALLBACK_PROXY_URL`; **ou**
3. Aceitar o risco e monitorar: o gateway já detecta `invalidIp` e faz failover para o proxy
   automaticamente (ver `apps/gateway/src/coc/client.ts`), então o app não cai — mas o caminho
   principal fica degradado até o IP ser recadastrado.

O endpoint `GET /health/egress-ip` existe exatamente para verificar isso a qualquer momento.

## 3. Variáveis configuradas

**Railway · gateway**

| Variável                      | Valor                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `PORT`                        | `4000` (fixado: o Railway injeta 8080 por padrão e o domínio aponta para 4000) |
| `NODE_ENV`                    | `production`                                                                   |
| `GATEWAY_SECRET`              | segredo HMAC de 48 caracteres, igual ao da Vercel                              |
| `COC_API_TOKEN`               | ⚠️ `pendente-aguardando-ip-fixo` — **trocar pela chave real**                  |
| `COC_FALLBACK_PROXY_URL`      | `https://cocproxy.royaleapi.dev/v1`                                            |
| `COC_RATE_LIMIT_RPS`          | `10`                                                                           |
| `DATABASE_URL` / `DIRECT_URL` | referências ao serviço `Postgres`                                              |

**Vercel · clashpilot** — `COC_GATEWAY_URL`, `COC_GATEWAY_SECRET`, `NEXT_PUBLIC_APP_URL`.

## 4. Próximo passo bloqueante: a chave da API

1. Resolver o item 2 acima (IP fixo ou proxy).
2. Entrar em https://developer.clashofclans.com → _My Account_ → **Create New Key**.
3. Colar o IP escolhido na allowlist (a chave aceita até 5 CIDRs).
4. `railway variables --service gateway --set "COC_API_TOKEN=<chave>"`.
5. Validar: uma tag real deve voltar o perfil normalizado pelo gateway.

Enquanto isso não acontece, o gateway responde `502` com `{"kind":"unauthorized"}` em
`/players/:tag` — comportamento correto e esperado, não é bug.

## 5. Armadilhas já encontradas (para não repetir)

| Sintoma                                                    | Causa                                                              | Correção aplicada                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `ERR_MODULE_NOT_FOUND: packages/core/src/shared/result.js` | tsup deixou os pacotes do workspace como externos; eles são TS cru | `noExternal: [/^@clashpilot\//]` em `tsup.config.ts`                  |
| Healthcheck falha, app "Online" mas `502`                  | Railway injeta `PORT=8080`; o domínio apontava para 4000           | `PORT=4000` fixado como variável                                      |
| `TypeError: Invalid URL` no build do Next                  | PowerShell escreveu BOM no início da variável na Vercel            | `apps/web/src/lib/env.ts` sanitiza e cai no padrão; coberto por teste |
| `No Next.js version detected`                              | Root Directory da Vercel apontava para a raiz do monorepo          | Root Directory = `apps/web`, build em auto-detecção                   |
