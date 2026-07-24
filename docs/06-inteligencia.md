# Motor de inteligência

Tudo aqui é **função pura** em `packages/core/domain`. Determinístico, versionado e testável.
O LLM entra apenas na camada de _explicação_, nunca no cálculo — ver §5.

---

## 1. Progresso MAX (`maxProgressBp`)

### Princípio: ponderar por **custo acumulado**, não por nível

Um nível de Rei do 79→80 não vale o mesmo que um Canhão 1→2. Contar níveis dá um número
bonito e inútil. O ClashPilot pondera pelo **custo total investido** (convertido em
"tempo-equivalente de builder"), que é o recurso realmente escasso.

```
Para cada item i do catálogo esperado no TH atual:
  invested(i)  = Σ custo(nível 1 .. nível_atual)
  required(i)  = Σ custo(nível 1 .. max_no_TH_atual)

maxProgress = Σ w(cat) · ( Σ invested(i∈cat) / Σ required(i∈cat) )
```

Notas de precisão:

- `max_no_TH_atual` vem de `coc-data`, **não** do `maxLevel` da API (ver 01 §3).
- Itens não desbloqueados no TH atual: `invested = 0`, `required` conta. Item ainda não
  existente no TH: fora do denominador.
- Super Tropas ativas e tropas da Builder Base: fora do cálculo da vila principal.
- Muralhas: `Σ (count_nível_n × custo_cumulativo(n))` — muralha é ~35% do ouro de um TH alto;
  ignorar isso distorce tudo.
- Resultado guardado em **basis points** (`7240` = 72,40%) para evitar float no banco.

### Pesos por categoria (`w`)

| Categoria                   | Peso | Razão                                         |
| --------------------------- | ---- | --------------------------------------------- |
| Defesas                     | 0,22 | maior sumidouro de ouro e de tempo de builder |
| Muralhas                    | 0,10 | grande custo, baixo impacto marginal          |
| Tropas + Feitiços (lab)     | 0,18 | define o poder ofensivo real                  |
| Heróis                      | 0,20 | maior impacto por unidade de investimento     |
| Pets                        | 0,07 |                                               |
| Equipamentos                | 0,08 |                                               |
| Armadilhas                  | 0,05 |                                               |
| Prédios de exército/recurso | 0,10 | acampamentos e armazéns destravam o resto     |

Pesos ficam em `coc-data/weights.ts`, versionados: mudança de peso muda histórico,
então cada snapshot grava `scoreVersion`.

---

## 2. Village Score (0–100)

MAX% mede _quanto falta_. O Score mede _quão bem construída_ está a vila — inclui equilíbrio
e penaliza distorções. É o número que vira "93/100".

```
base      = maxProgress no TH atual (0..100)
balance   = 100 − desvio-padrão das completudes por categoria      // vila torta perde ponto
priority  = aderência à ordem ideal (lab/acamp/heróis antes de muralha)
recency   = fator de atividade dos últimos 14 dias                  // vila parada não é vila boa

VillageScore = round( 0,55·base + 0,20·balance + 0,15·priority + 0,10·recency )
```

- `balance` captura o caso "defesa max, herói nível 30" — comum e ruim.
- `priority` compara o vetor de investimento **do último mês** com o vetor ideal do TH
  (similaridade de cosseno × 100). É o que permite dizer _"você está priorizando muralha cedo demais"_
  com um número por trás.
- Breakdown por categoria sempre exibido — score sem explicação é ruído.

---

## 3. Motor de prioridades (o produto de verdade)

Cada upgrade possível vira um `UpgradeCandidate` pontuado por ROI:

```
score(c) = ( V(c) × M_meta × M_gargalo × M_recursos ) / C(c)

V(c) = valor tático: ganho de DPS/HP/capacidade/velocidade normalizado 0..1
       (heróis e acampamentos altos; decoração zero)
C(c) = custo normalizado = α·tempoBuilder + β·recurso_escasso + γ·custo_de_oportunidade
M_meta     = peso do item no meta atual do TH (tabela curada, ex.: Lab > Acampamento > Castelo)
M_gargalo  = 1,5 se o item destrava outros (armazém insuficiente, acampamento cheio, lab atrasado)
M_recursos = 1,3 se o usuário já tem o recurso em caixa e ele está próximo do cap
             0,6 se exigiria semanas de farm do recurso mais escasso
```

Restrições respeitadas: builders livres, nível do laboratório, requisitos de TH,
1 upgrade de herói por vez (salvo forja), lab ocupado, e "não subir TH com heróis atrasados".

Saída: lista ordenada com **motivo textual gerado a partir dos fatores** (não do LLM):

```
1. Laboratório → 12          ROI 9,2   destrava 7 pesquisas · lab parado há 8 h
2. Acampamento #3 → 12       ROI 8,1   +5 de espaço · gargalo de ataque
3. Rei Bárbaro → 76          ROI 7,4   melhor retorno por EN gasto
```

### Time-to-Max

```
tempoRestante = max(
    Σ tempo_de_construção_restante / builders_efetivos ,
    Σ tempo_de_pesquisa_restante  / labs_efetivos (=1)
) × fator_realismo
```

- `builders_efetivos = builders × ocupação_média_observada` (dos últimos 30 dias de `UpgradeJob`) —
  usar 100% dá previsão fantasiosa; a média real costuma ser 0,6–0,8.
- Fator de recursos: se a taxa de farm observada não sustenta o tempo de builder, o gargalo
  vira recurso e o tempo cresce proporcionalmente. É por isso que a estimativa do app difere
  (para melhor) das planilhas que só somam horas.
- Apresentar como faixa (P50–P90), nunca número único.

---

## 4. Analytics de eficiência

| Métrica                   | Fórmula                                               | Fonte               |
| ------------------------- | ----------------------------------------------------- | ------------------- |
| Ocupação de builder       | Σ horas com job ativo / (builders × horas do período) | `UpgradeJob`        |
| Ociosidade do lab         | horas sem pesquisa ativa                              | `UpgradeJob`        |
| Tempo desperdiçado        | horas de builder ocioso × builders                    | derivada            |
| Recursos desperdiçados    | horas com armazém no cap × taxa de coleta             | ledger + `coc-data` |
| Velocidade de evolução    | Δ maxProgressBp / dia (média móvel 7 d)               | snapshots           |
| Eficiência de recursos    | valor investido / valor coletado (achievements)       | API                 |
| Dias ativos / sem jogar   | dias com ≥1 `ProgressEvent` ou Δdoação                | API                 |
| Economia de Livro/Martelo | tempo do job pulado − tempo médio de builder          | `UpgradeJob`        |

---

## 5. AI Advisor

**Arquitetura de duas camadas — inegociável:**

```
pergunta do usuário
   ↓
[1] Roteador determinístico → identifica intenção e chama as FUNÇÕES PURAS do core
      "o que melhorar?"      → getPriorities()
      "posso subir de TH?"   → thReadinessCheck()      // heróis, lab, defesas vs. checklist
      "vale muralha?"        → wallInvestmentAnalysis()
      "maior retorno?"       → getPriorities(top=3)
      "por que estou lento?" → efficiencyReport()
   ↓
[2] LLM (Claude) recebe SÓ o resultado estruturado + a pergunta
      e escreve a explicação em pt-BR, citando os números recebidos
```

O LLM **não** calcula, não estima e não inventa números — ele redige. Isso garante:
resposta reproduzível, custo baixo (contexto pequeno), zero alucinação numérica, e
funcionamento **sem LLM** (fallback com texto template) se a chave faltar ou o custo apertar.

- **Provedor é plugável** (`llm.port.ts`). Padrão de lançamento: **Google AI Studio —
  `gemini-2.5-flash`** (free tier generoso, sem cartão de crédito). Fallback automático:
  **Groq — `llama-3.3-70b`** (também grátis, sem cartão, latência muito baixa).
  Terceiro nível de fallback: textos-template determinísticos, sem LLM nenhum.
  Trocar para `claude-sonnet-5` depois é substituir um adaptador. Ver [ADR-012](./10-decisoes.md).
- O consumo é pequeno por construção: entrada de ~2–4k tokens e saída de ~200 tokens por
  resposta, porque o modelo recebe resultado já calculado e só redige. É o que faz um free
  tier ser suficiente de verdade, não apenas para testes.
- Contexto injetado: score + breakdown, top-10 prioridades, últimos 30 dias de métricas,
  metas ativas, ledger. ~2–4k tokens.
- Streaming via Route Handler + `AI SDK`; histórico em `AdvisorMessage` com `contextHash`
  para reproduzir a resposta depois.
- Rate limit por usuário (ex.: 30 msg/dia no tier grátis).

---

## 6. Regras de insight (exemplos, todas puras e testáveis)

```ts
// packages/core/domain/insights/rules/lab-idle.rule.ts
export const labIdleRule: InsightRule = {
  key: "lab_idle",
  evaluate: ({ jobs, now }) => {
    const idleHours = hoursSinceLastLabJob(jobs, now);
    if (idleHours < 6) return null;
    return {
      severity: idleHours > 24 ? "WARNING" : "INFO",
      title: `Laboratório parado há ${formatHours(idleHours)}`,
      body: `Você perdeu ~${Math.round(idleHours)} h de pesquisa. A próxima recomendada é ${...}.`,
      actionKey: "start:lab",
    };
  },
};
```

Catálogo v1: `lab_idle` · `builder_idle` · `wall_overinvest` · `hero_behind_th` ·
`camp_bottleneck` · `storage_cap_risk` · `th_rush_warning` · `donation_streak` ·
`velocity_up` · `velocity_down` · `inactive_days` · `season_ending` · `resource_surplus`.

## 7. Conquistas e gamificação

- `AchievementDef.rule` é uma DSL declarativa (JSON) avaliada pelo motor — adicionar
  conquista é seed, não deploy de código.
- XP por conquista → `plannerXp` → `PlannerTier` (Bronze 0 / Silver 500 / Gold 2 000 /
  Diamond 6 000 / Legend 15 000).
- Regra de design: gamificação **interna** premia comportamento eficiente (builder ocupado,
  lab ativo, meta cumprida), nunca tempo de tela.
