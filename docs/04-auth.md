# Fluxo de autenticação

**Better Auth** (não NextAuth). Justificativa em ADR-002: schema Prisma nativo e tipado,
sessões em banco com revogação real, plugins de passkey/2FA sem adaptador, API de servidor
tipada ponta a ponta e melhor ergonomia com Server Actions. NextAuth v5 continua com
tipagem frouxa em `session.user` e adaptadores como cidadão de segunda classe.

---

## 1. Identidade do usuário ≠ identidade do jogador

Dois níveis, deliberadamente separados:

| Nível                | O que é        | Como se prova                     |
| -------------------- | -------------- | --------------------------------- |
| **Conta ClashPilot** | quem loga      | e-mail+senha, Google, ou passkey  |
| **Conta de jogo**    | vila analisada | `POST /players/{tag}/verifytoken` |

Um usuário pode ter N contas de jogo (multi-conta é comum); uma é `isPrimary`.

---

## 2. Fluxo de cadastro/login

```
/sign-in ──► Better Auth ──► sessão (cookie httpOnly, SameSite=Lax, secure)
   │  provedores: Google OAuth · e-mail+senha (Argon2id) · Passkey (WebAuthn)
   └─► se user.players.length === 0 → redirect /link-player
```

- Verificação de e-mail obrigatória para push notifications e exportação de dados.
- Rate limit em `/sign-in` e `/link-player` (Upstash Ratelimit, sliding window 10/min por IP).
- Sessão: 30 dias com rolling refresh; revogação por dispositivo em `/config/seguranca`.

## 3. Vinculação e verificação da conta de jogo

```
┌─ Passo 1 ── usuário digita a tag (#ABC123)
│  normalização: upper, remove espaços, valida charset CoC (0289PYLQGRJCUV)
│  GET /players/{tag} via gateway → existe? mostra preview (nome, TH, clã, liga)
│
├─ Passo 2 ── escolha do modo
│  ┌ "É minha conta"  → exige token de API do jogo  → VERIFICADA
│  └ "Só acompanhar"  → sem token                   → OBSERVAÇÃO (read-only)
│
├─ Passo 3 (verificada) ── instruções ilustradas:
│  Jogo → Configurações → Mais Configurações → Conta da API → Mostrar → copiar
│  POST /players/{tag}/verifytoken  { token }
│    status "ok"      → Player.verified = true, verifiedAt = now()
│    status "invalid" → erro claro ("token expira em ~5 min, gere outro")
│
└─ Passo 4 ── sync inicial: cria PlayerCurrent + snapshot #1 + backfill de eventos
   deriváveis das achievements → dashboard já abre com conteúdo
```

**Por que exigir verificação:** o Village Ledger, metas, notificações e o Advisor gravam
inferências pessoais. Sem prova de propriedade, o app viraria ferramenta de vigilância
de terceiros. Modo observação existe (dados já públicos pela API) mas é limitado a
resumo + timeline pública, sem ledger, sem push, sem advisor.

## 4. Autorização

- Toda Server Action começa por `requirePlayerAccess(playerId)`: resolve sessão →
  confirma `player.userId === session.userId` → devolve contexto tipado.
  Sem esse helper, a action não passa no lint (regra custom + revisão).
- IDs expostos na URL são `tag` (público) ou `cuid` (não sequencial). Nunca inteiro.
- Gateway aceita só requisições assinadas com HMAC-SHA256 (`x-cp-signature`, timestamp,
  janela de 60 s) — a chave da Supercell nunca sai do gateway.

## 5. Privacidade e LGPD

- Exportação completa (JSON) e exclusão de conta em `/config/privacidade` — a exclusão
  apaga snapshots e eventos em cascata (o "nunca perder histórico" vale para o usuário,
  não contra ele).
- Nada de PII em logs; tags de jogador são pseudonimizadas em telemetria.
- Perfil público (`/perfil/[tag]`) é **opt-in** e mostra só dados que a API já expõe.
