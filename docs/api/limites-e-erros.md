# Autenticação, limites, erros e estratégias de contorno

---

## 1. Autenticação (OFICIAL)

Texto literal do portal (`developer.clashofclans.com`, bundle JS):

> _"To use the API, a JSON Web Token is required and it needs to be passed as part of every request. The token is bound to rate limitations and specified IP addresses, so you will need a web server to fetch data from the API and host your application. The API enforces these restrictions and exceeding the limitations will cause API calls to fail."_

> _"Keys help in controlling access and traffic to the API. When creating a key you need to specify the IP addresses that are allowed to access the API endpoints. We recommend that you keep the keys private and create individual keys for each of your applications to avoid exceeding the rate limits unexpectedly."_

Uso:

```http
GET /v1/players/%232PP HTTP/1.1
Host: api.clashofclans.com
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9...
```

O JWT **não expira por tempo** (não tem `exp` prático) — ele é invalidado quando você o revoga no portal ou quando o IP de origem não bate.
O payload do JWT (base64 do 2º segmento) contém um array `limits` com, entre outras coisas, `{ "cidrs": ["<seu-ip>/32"] }` e `{ "type": "throttling", "tier": "..." }`. **Você pode decodificar o próprio token para descobrir o IP autorizado sem chamar nenhum serviço externo** (é exatamente o que o `clashofclans.js` faz).

---

## 2. Allowlist de IP — regras exatas

| Regra                                                                            | Valor                                                                                                                                                                        | Origem                                                                                                              |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| IPs permitidos por chave                                                         | **5** por padrão (`user.profile.developer.maxCidrs \|\| 5`)                                                                                                                  | **OFICIAL** — extraído do bundle JS do portal                                                                       |
| Chaves por conta                                                                 | **10**                                                                                                                                                                       | **OBSERVADO** — hardcoded em `clashofclans.js` (`Math.min(keyCount, 10)`) e relatado consistentemente na comunidade |
| Formato aceito pelo formulário web                                               | **IPv4 puro** (`1.2.3.4`). Regex do portal: `isValidIPAddress` — **sem máscara**                                                                                             | **OFICIAL** (bundle)                                                                                                |
| IPs privados                                                                     | **Bloqueados**: `127.*`, `10.*`, `172.16-31.*`, `192.168.*` (`isPublicIPAddress`)                                                                                            | **OFICIAL** (bundle)                                                                                                |
| CIDR                                                                             | O campo da API se chama `cidrRanges` e o portal **tem** um validador `isValidIPRange` (`x.x.x.x/nn`), mas **o formulário de criação usa `isValidIPAddress`, não o de range** | **OFICIAL** (bundle)                                                                                                |
| CIDR via API direta (`POST /api/apikey/create` com `cidrRanges: ["1.2.3.0/24"]`) | ⚠️ **NÃO CONFIRMADO.** Relatos da comunidade dizem que o backend aceita `/nn`, mas o portal não expõe. Não construir arquitetura em cima disso.                              | ⚠️                                                                                                                  |
| IPv6                                                                             | **Não suportado** — a regex é IPv4-only                                                                                                                                      | **OFICIAL** (bundle)                                                                                                |

**Capacidade teórica máxima por conta de dev: 10 chaves × 5 IPs = 50 IPs distintos.** Isso não escala para serverless.

---

## 3. Rate limits

### O que é OFICIAL

- Existe rate limit por token; excedê-lo faz as chamadas falharem com **`429 requestThrottled`**.
- O portal **não publica número algum**. Não há header `X-RateLimit-*` nas respostas (verificado em requisição real 2026-07: os únicos headers são `Date`, `Content-Type`, `Content-Length`, `Connection`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Cache-Control`).

### O que é OBSERVADO pela comunidade

| Métrica                         | Valor típico                                                                                      | Fonte                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Throughput seguro por chave     | **~10–30 req/s**                                                                                  | Defaults dos wrappers: `coc.py` usa 10 req/s por token; `clashofclans.js` sugere `QueueThrottler(1000/10)` ou `BatchThrottler(30)` |
| Duração do bloqueio ao estourar | **~30–60 s** sem poder requisitar                                                                 | Documentação do `coc.py`                                                                                                           |
| Escalonamento                   | Limite é **por token**, não por conta nem por IP → N chaves = N× throughput (rotação round-robin) | Implementação de todos os wrappers maduros                                                                                         |
| Concorrência                    | Nenhum limite de conexões simultâneas observado; o gargalo é req/s                                | ⚠️                                                                                                                                 |

**Recomendação para o ClashPilot:** dimensionar para **10 req/s por chave** com back-off exponencial em `429`, e tratar o `Cache-Control` de cada endpoint como o piso real de repolling (não adianta bater `/players/{tag}` a cada 10 s — `max-age=60`).

---

## 4. Códigos de erro

Formato do corpo: `{ "reason": string, "message"?: string }`.
**Todos os erros vêm com `Cache-Control: public max-age=600`** — o CDN cacheia o erro por 10 minutos. Se você errar um parâmetro, corrigir e repetir, pode receber o erro cacheado. Varie a query string para furar o cache durante debug.

| HTTP    | `reason`                 | `message` típico                           | Quando acontece                                                                                                                                                     |
| ------- | ------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **400** | `badRequest`             | `"Unknown value for parameter locationId"` | Parâmetro inválido; `after` **e** `before` juntos; busca de clã sem nenhum filtro; `name` com < 3 chars                                                             |
| **403** | `accessDenied`           | `"Missing authorization"`                  | Header `Authorization` ausente/malformado, token revogado                                                                                                           |
| **403** | `accessDenied`           | `"Invalid authorization"`                  | Token inválido                                                                                                                                                      |
| **403** | `accessDenied.invalidIp` | contém o IP de origem                      | **IP de origem não está na allowlist da chave.** O `message` costuma **revelar o seu IP público** — é um jeito barato de descobri-lo                                |
| **403** | `accessDenied`           | **sem `message`**                          | **War log privado.** Único caso em que a API responde 403 com corpo `{"reason":"accessDenied"}` e nada mais. Wrappers traduzem para o pseudo-reason `privateWarLog` |
| **404** | `notFound`               | `"Not found with tag 2PP"`                 | Tag inexistente; clã fora de CWL em `/currentwar/leaguegroup`; warTag `#0`                                                                                          |
| **429** | `requestThrottled`       | —                                          | Rate limit estourado                                                                                                                                                |
| **500** | `unknownException`       | —                                          | Erro interno                                                                                                                                                        |
| **503** | `inMaintenance`          | —                                          | **Manutenção do jogo**                                                                                                                                              |
| **504** | `requestAborted`         | —                                          | Gateway timeout — **retry é seguro e recomendado** (todos os wrappers dão retry automático em 504)                                                                  |

Pseudo-reason usado por wrappers (não vem da API): `privateWarLog`, `notInWar`.

### Comportamento em manutenção (503 `inMaintenance`)

- Acontece **toda semana durante a atualização de temporada** e em updates do jogo — tipicamente 10–60 min.
- **Toda** a API v1 responde 503 (não é por endpoint).
- Não há header de `Retry-After`.
- **Consequência crítica para o ClashPilot:** a virada de temporada (reset de `donations`, `attackWins`, `defenseWins`, `trophies`) acontece **exatamente durante a janela de manutenção**. Se o job de snapshot rodar depois do reset, você perde o valor final da temporada para sempre. **Snapshot obrigatório antes do fim da temporada** (use `/goldpass/seasons/current.endTime` para agendar, ~15 min antes).

---

## 5. Cache-Control por endpoint

Ver tabela completa em [endpoints.md](./endpoints.md#tabela-resumo-de-cache-observado). Resumo:

| Faixa                        | Endpoints                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `max-age=60`                 | `/players/{tag}`, `/clans` (busca), rankings, gold pass                                                   |
| `max-age=60..120` (variável) | `/clans/{tag}`                                                                                            |
| `max-age=120`                | `members`, `warlog`, `currentwar`, `capitalraidseasons`                                                   |
| `max-age=600`                | `currentwar/leaguegroup`, `clanwarleagues/wars/{warTag}`, `verifytoken`, **e todas as respostas de erro** |

Esses valores são a **latência real de propagação** do dado. Não existe webhook nem streaming — a arquitetura é polling.

---

## 6. Estratégias de contorno da allowlist de IP

### 6.1 Proxy de IP fixo (RoyaleAPI) — **recomendado, é o desbloqueio principal**

`https://cocproxy.royaleapi.dev` espelha a API oficial 1:1 (verificado ativo em 2026-07: responde `{"reason":"accessDenied","message":"Missing authorization"}` com os mesmos headers, servido por Cloudflare).

Como usar:

1. Criar chave no portal oficial com o IP **`45.79.218.79`** na allowlist.
2. Trocar a base URL de `https://api.clashofclans.com` para `https://cocproxy.royaleapi.dev` — path (`/v1/...`), header `Authorization` e respostas são idênticos.

| Aspecto           | Avaliação                                                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Risco de TOS      | **Baixo.** Você usa a sua própria chave; o proxy só encaminha. É a solução recomendada publicamente pela RoyaleAPI e usada por boa parte do ecossistema. |
| Risco operacional | **Médio.** Dependência de terceiro sem SLA; ponto único de falha; latência extra. O IP do proxy já mudou uma vez (`128.128.128.128` → `45.79.218.79`).   |
| Rate limit        | Sujeito ao limite da **sua** chave + limites do proxy. ⚠️ Limites próprios do proxy não são documentados.                                                |
| Privacidade       | Seu Bearer token trafega pelo proxy. **Use uma chave dedicada e revogável**, nunca a mesma da infra crítica.                                             |

> **⚠️ Isso contradiz a premissa (b) do projeto.** Chamar da Vercel **é viável** via proxy de IP fixo. Ver README.

### 6.2 IP fixo próprio (a alternativa robusta)

Um worker/VPS pequeno com IP estático (Fly.io com IP dedicado, Railway, Hetzner, Oracle Free Tier, ou NAT Gateway estático da AWS/GCP) faz **todas** as chamadas à Supercell e serve o ClashPilot via API interna ou grava direto no banco.

| Aspecto      | Avaliação                                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Risco de TOS | **Nulo**                                                                                                                |
| Custo        | US$ 0–5/mês                                                                                                             |
| Bônus        | Vira naturalmente a camada de **cache/ingestão** — que o ClashPilot precisa de qualquer forma para as séries históricas |

**Esta é a arquitetura correta para o ClashPilot**: o produto depende de _snapshots ao longo do tempo_, então precisa de um ingestor persistente independente do front. A Vercel hospeda o Next.js; o ingestor roda separado. O proxy da RoyaleAPI vira apenas o fallback/atalho para chamadas on-demand (ex.: um usuário digitando uma tag na busca).

### 6.3 Rotação de chaves

Legítimo e explicitamente incentivado pelo portal (_"create individual keys for each of your applications to avoid exceeding the rate limits"_). Round-robin entre N chaves multiplica o throughput por N. Todos os wrappers já implementam.

- Limite prático: **10 chaves/conta**.
- **Risco:** criar múltiplas contas de dev só para multiplicar chaves é evasão de limite e **viola o espírito dos ToS**. Não fazer.

### 6.4 Geração programática de chave via login no dev portal

Fluxo (implementado por `clashofclans.js`, `coc.py` e praticamente todos os wrappers):

```
POST https://developer.clashofclans.com/api/login          { email, password }
      → Set-Cookie: session=...  +  { temporaryAPIToken }   (o JWT temporário revela o seu IP em limits[].cidrs)
POST https://developer.clashofclans.com/api/apikey/list     (cookie)
POST https://developer.clashofclans.com/api/apikey/create   (cookie) { name, description, cidrRanges: ["<ip>"], scopes }
POST https://developer.clashofclans.com/api/apikey/revoke   (cookie) { id }
```

| Aspecto                        | Avaliação                                                                                                                                                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Risco de TOS                   | **Médio.** Não é uma API pública documentada — é o backend do site. Não há proibição explícita, e é prática universal no ecossistema há anos sem casos conhecidos de punição. Mas é uma superfície que a Supercell pode fechar sem aviso. |
| Risco de segurança             | **Alto.** Exige guardar **e-mail e senha em texto utilizável** no ambiente de execução. Comprometeu o servidor, comprometeu a conta de dev.                                                                                               |
| Quando usa                     | Só faz sentido em ambiente de **IP dinâmico** (a chave se auto-recria quando o IP muda).                                                                                                                                                  |
| Recomendação para o ClashPilot | **Não usar.** Com IP fixo (6.2) ou proxy (6.1), o problema que isso resolve deixa de existir. Se um dia for necessário, isolar num serviço próprio, com credenciais em secret manager e conta de dev dedicada.                            |

### 6.5 O que NÃO fazer

- Chamar `api.clashofclans.com` direto do **navegador**: além do IP, a API **não envia headers CORS** — a chamada é bloqueada. E exporia o Bearer token.
- Colocar a chave em `NEXT_PUBLIC_*`.
- Tentar cobrir os IPs efêmeros da Vercel na allowlist — as faixas de saída da Vercel não são estáveis nem documentadas, e não caberiam em 5 entradas.
- Scraping do cliente do jogo ou uso de APIs internas não públicas — fora de escopo e viola os ToS.
