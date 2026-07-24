# Wireframes

Notação: `[ ]` container · `▓` barra de progresso · `◯` anel · `▸` ação.
Cada tela indica o comportamento de carregamento (Suspense/Skeleton) e a variante mobile.

---

## 1. Onboarding — `/link-player`

```
┌──────────────────────────────────────────────┐
│                 ClashPilot                   │
│   Vamos encontrar sua vila                   │
│                                              │
│   Tag do jogador                             │
│   ┌────────────────────────────┐             │
│   │ #  ABC12DEF                │  ▸Buscar    │
│   └────────────────────────────┘             │
│                                              │
│   ┌── preview (após buscar) ──────────────┐  │
│   │  Alan      TH14 · Legend · 3.120 🏆   │  │
│   │  Clã: Nome do Clã                     │  │
│   │  [ É minha conta ]  [ Só acompanhar ] │  │
│   └───────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
        ↓ "É minha conta"
┌──────────────────────────────────────────────┐
│  Prove que a vila é sua (30 segundos)        │
│  1. Jogo → Config. → Mais Config.            │
│  2. Conta da API → Mostrar → Copiar          │
│  [ colar token aqui ]            ▸Verificar  │
│  ⓘ O token expira em poucos minutos          │
└──────────────────────────────────────────────┘
        ↓ verificado
┌──────────────────────────────────────────────┐
│  Quase lá — como está sua vila?              │
│  ( ) Tudo no máximo do TH13, subi há pouco   │  ← heurística de 1 clique
│  ( ) Vou preencher os detalhes agora         │
│  ( ) Depois (libera MAX% e custos mais tarde)│
└──────────────────────────────────────────────┘
```

---

## 2. Dashboard — `/dashboard`

```
┌─ topbar (glass) ─────────────────────────────────────────────┐
│ ClashPilot   Alan #ABC12  ▾    [⌘K]   sync há 4 min ↻   ◑ 👤 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Vila máxima                                          72,4%  │  ← 48px mono
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░  TH14 · faltam 4 m│
│  Defesas 68% · Tropas 81% · Heróis 63% · Muralhas 55%        │
│                                                              │
│ ┌──────────────┐ ┌─────────────────────────────────────────┐ │
│ │  ◯  93       │ │  Próxima jogada                         │ │
│ │  Village     │ │  1 ▸ Laboratório → 12      ROI 9,2      │ │
│ │  Score       │ │      destrava 7 pesquisas · parado 8 h  │ │
│ │  +2 na semana│ │  2 ▸ Acampamento #3 → 12   ROI 8,1      │ │
│ │              │ │  3 ▸ Rei Bárbaro → 76      ROI 7,4      │ │
│ └──────────────┘ │                        ▸ Ver plano completo│
│                  └─────────────────────────────────────────┘ │
│ ┌────────┬────────┬────────┬────────┬────────┬─────────────┐ │
│ │ TH 14  │ XP 187 │🏆 3120 │ Melhor │ Liga   │ Construtores│ │
│ │        │        │  +42   │ 3450   │ Legend │  4/6 livres │ │
│ └────────┴────────┴────────┴────────┴────────┴─────────────┘ │
│ ┌── Construtores ──────────────┐ ┌── Insights ──────────────┐│
│ │ 1 Canhão 14    ██░ 6h12m     │ │ ⚠ Lab parado há 8 h      ││
│ │ 2 Muralha      ░░░ livre     │ │ ⓘ Você evoluiu 18% mais  ││
│ │ 3 Rei 76       ████ 2d 4h    │ │   rápido que semana pass.││
│ │ 4 livre  5 livre  6 livre    │ │ ⚠ Muralha cedo demais    ││
│ │ Lab: livre  ⚠                │ │                    ▸ mais││
│ └──────────────────────────────┘ └──────────────────────────┘│
│ ┌── Últimos 30 dias ───────────────────────────────────────┐ │
│ │  progresso ▁▂▃▃▄▅▅▆▆▇█   troféus ▂▄▃▅▆▅▇█   ▸ Timeline  │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Mobile:** mesma ordem em coluna única. Barra MAX% e Próxima jogada acima da dobra —
são as duas coisas que justificam abrir o app. Tab bar inferior.

**Carregamento:** shell + barra MAX% vêm do servidor (cacheados). `<Suspense>` por seção:
Score → Prioridades → Construtores → Insights → Gráficos. Skeletons com dimensões exatas.

---

## 3. Plano — `/plano`

```
┌──────────────────────────────────────────────────────────────┐
│ Plano de evolução      [Ordenar: ROI ▾] [Filtro: Tudo ▾]     │
│ Simulação: builders 6 ▾ · livro ☐ · martelo ☐ · gemas 0      │
├──────────────────────────────────────────────────────────────┤
│ PRIORIDADE MÁXIMA                                            │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 1  Laboratório → 12                            ROI 9,2   │ │
│ │    2.150.000 elixir · 5d 12h · lab                       │ │
│ │    "Destrava 7 pesquisas travadas. Está parado há 8 h."  │ │
│ │                        [▸ Iniciar agora] [Adiar] [Por quê?]│
│ └──────────────────────────────────────────────────────────┘ │
│ DEPOIS                                                       │
│ 2  Acampamento #3 → 12    ROI 8,1   1,8M elixir · 4d         │
│ 3  Rei Bárbaro → 76       ROI 7,4   180k EN · 6d 12h         │
│ 4  Castelo → 10           ROI 6,9   ...                      │
│ 5  Quartel → 16           ROI 5,2   ...                      │
│ …                                                            │
├──────────────────────────────────────────────────────────────┤
│ Se seguir este plano: vila máxima em ~7 meses (P50) / 11 (P90)│
└──────────────────────────────────────────────────────────────┘
```

"Iniciar agora" cria um `UpgradeJob` → alimenta builders, alertas e analytics. É o loop
que mantém a camada B viva sem formulário.

---

## 4. Advisor — `/advisor`

```
┌──────────────────────────────────────────────────────────────┐
│  AI Advisor                          contexto: #ABC12 · hoje │
├──────────────────────────────────────────────────────────────┤
│  Sugestões:                                                  │
│  [O que devo melhorar agora?] [Posso subir de TH?]           │
│  [Vale investir em muralhas?] [O que está me atrasando?]     │
│                                                              │
│  ┌ você ─────────────────────────────────────────────────┐   │
│  │ Posso subir para o TH15?                              │   │
│  └───────────────────────────────────────────────────────┘   │
│  ┌ advisor ──────────────────────────────────────────────┐   │
│  │ Ainda não recomendo. Checklist de subida:             │   │
│  │  ✓ Laboratório 100% no TH14                           │   │
│  │  ✓ Acampamentos no máximo                             │   │
│  │  ✗ Heróis: Rei 75/80, Rainha 72/80 (faltam 13 níveis) │   │
│  │  ✗ Defesas 68% (recomendado ≥ 85%)                    │   │
│  │ Subir agora adiciona ~2 meses ao seu tempo até o máx.  │   │
│  │ Sugestão: 3 semanas de heróis primeiro.               │   │
│  │                                    [ver cálculo] [plano]│   │
│  └───────────────────────────────────────────────────────┘   │
│  [ pergunte qualquer coisa sobre sua vila…            ] ▸    │
└──────────────────────────────────────────────────────────────┘
```

Cada resposta traz "ver cálculo" → abre o objeto estruturado que gerou o texto. Transparência
é o que separa isso de um chatbot genérico.

---

## 5. Vila (Village Ledger) — `/vila`

```
┌──────────────────────────────────────────────────────────────┐
│ Minha vila · TH14           confiança do dado: 92% ●         │
│ [Defesas] [Recursos] [Exército] [Muralhas] [Armadilhas]      │
├──────────────────────────────────────────────────────────────┤
│  Canhão            ×7    níveis: [14][14][13][14][12][14][14]│
│  Torre Arqueira    ×8    [15][15][15][14][15][15][13][15]    │
│  Morteiro          ×4    [12][12][11][12]                    │
│  …                                                            │
│  ▸ "Marcar todos no máximo do TH13"   ▸ "Todos no máximo"     │
├──────────────────────────────────────────────────────────────┤
│  Muralhas: 300 peças    nível 12: 180  · 11: 90 · 10: 30      │
│  ▓▓▓▓▓▓▓▓▓░░░░  55% concluído                                │
└──────────────────────────────────────────────────────────────┘
```

Grade com teclado numérico, `Tab` entre campos, salvamento otimista com Server Action,
funciona offline (Background Sync).

---

## 6. Timeline — `/timeline`

```
┌──────────────────────────────────────────────────────────────┐
│ [7d] [30d] [90d] [1a] [tudo]     [Troféus ▾ + comparar ▾]    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │      gráfico de área — troféus / XP / progresso        │  │
│  │      hoje ── linha sólida · semana passada ── tracejada│  │
│  └────────────────────────────────────────────────────────┘  │
│ ─────────────────────────────────────────────────────────────│
│  HOJE                                                        │
│   ● 14:20  Rei Bárbaro 75 → 76                               │
│   ● 09:05  Laboratório concluiu Dragão 8                     │
│  ONTEM                                                       │
│   ● 22:10  Liga: Titan I → Legend                            │
│   ● 18:44  +3 níveis de muralha                              │
└──────────────────────────────────────────────────────────────┘
```

Virtualização (`@tanstack/react-virtual`) + paginação por cursor.

---

## 7. Estatísticas — `/stats`

```
┌──────────────────────────────────────────────────────────────┐
│ Restante até vila máxima                                     │
│ ┌──────────┬──────────┬──────────┬──────────┐                │
│ │ Tempo    │ Ouro     │ Elixir   │ Elixir N.│                │
│ │ 7m 12d   │ 412 M    │ 388 M    │ 24,1 M   │                │
│ └──────────┴──────────┴──────────┴──────────┘                │
│ Upgrades restantes: 218   ·   Builder-dias: 640              │
│                                                              │
│ Por categoria ─ barras horizontais com tempo e custo         │
│ Defesas   ▓▓▓▓▓▓░░░░ 68%   3m 4d   210 M ouro                │
│ Muralhas  ▓▓▓▓▓░░░░░ 55%   —       160 M ouro                │
│ …                                                            │
│                                                              │
│ Eficiência (30 d)                                            │
│  Ocupação de builder  78%  ▲6   Lab ativo  91%  ▲12          │
│  Tempo desperdiçado   26 h ▼    Recursos desperdiçados 12 M  │
│  Velocidade  +0,42 %/dia  → máximo em ~7 meses               │
│                                                              │
│ Economia com Livro/Martelo: 14d 6h poupados (6 usos)         │
└──────────────────────────────────────────────────────────────┘
```

## 8. Comparações — `/stats/comparar`

Tabela lado a lado: **Hoje · 7 dias · 30 dias · Início da conta**, com delta e seta por métrica.
Gráfico sobreposto com opacidade decrescente para períodos antigos.

## 9. Calculadoras — `/calculadoras/[tool]`

Cinco ferramentas em abas, 100% client-side (offline):
`evolucao` (o que consigo com X recursos) · `tempo` (quanto falta para Y) ·
`recursos` (quanto preciso farmar) · `gemas` (vale gemar? custo em gemas por hora restante) ·
`eficiencia` (livro/martelo/potion: onde rende mais).

## 10. Metas — `/metas` · 11. Conquistas — `/conquistas` · 12. Calendário — `/calendario`

- **Metas**: card por meta com anel de progresso, data projetada vs. prazo, e
  "no ritmo atual você chega em 12/09 — 5 dias antes".
- **Conquistas**: grade de badges, bloqueadas em silhueta, barra de tier Planner no topo.
- **Calendário**: mês com marcadores de CWL, Clan Games, Capital Raid, fim de temporada,
  Gold Pass; lista dos próximos 7 dias ao lado.

## 13. Perfil — `/perfil/[tag]`

Resumo + evolução + timeline resumida + conquistas + estatísticas. Compartilhável (opt-in),
com OG image gerada (`next/og`) mostrando score, TH e MAX% — vetor de crescimento orgânico.

## 14. Estados globais

- **Vazio**: nunca uma tela em branco — sempre a ação que gera o dado.
- **Erro de sync**: banner discreto, dados em cache continuam visíveis com selo "há 2 h".
- **Manutenção do jogo**: banner âmbar, app 100% funcional em modo leitura.
- **Offline**: chip "offline" na topbar, calculadoras e histórico continuam funcionando.
