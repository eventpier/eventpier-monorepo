# Research — Atualizar actions/checkout e actions/setup-node (014)

## Decisão 1 — Versões-alvo

Resolvido via GitHub API (`gh api`) em 2026-08-25, no momento deste
`/plan` (a spec deliberadamente não fixou uma versão, para não
envelhecer — ver `spec.md`, seção Clarificações):

| Action | Versão mais recente | SHA de commit (40 chars) | `runs.using` (confirmado lendo `action.yml` na tag) |
|---|---|---|---|
| `actions/checkout` | `v7.0.1` (publicada 2026-07-20) | `3d3c42e5aac5ba805825da76410c181273ba90b1` | `node24` |
| `actions/setup-node` | `v7.0.0` (publicada 2026-07-14) | `820762786026740c76f36085b0efc47a31fe5020` | `node24` |

Ambas já passaram por `v5` (primeira versão com `node24`, conforme a
investigação do `/specify-tech`) e `v6` — usar a mais recente
disponível (`v7`) em vez de fixar `v5` porque não há motivo para
introduzir débito de version-lag no mesmo commit que resolve outro
débito de versão.

**Alternativa rejeitada**: fixar exatamente `v5` (primeira versão sem
depreciação) só para "resolver o mínimo necessário". Rejeitada porque
o próximo `/plan` que precisasse tocar nesses workflows teria que
descobrir de novo que existe uma versão mais nova — sem ganho real em
troca (nenhum breaking change relevante entre v5→v7 para o uso feito
aqui: `actions/checkout` sem inputs além do default, `actions/setup-node`
só com `node-version`).

## Decisão 2 — Pin por SHA para as quatro actions (revisão da decisão de spec 004)

`spec.md` (seção Impacto) já registra o conflito com a decisão
original de `specs/004-configurar-ci-path-providers/contracts/ci-workflow-shape.md`,
que deixou `actions/checkout`/`actions/setup-node` fora do pin por SHA
por serem mantidas pela própria GitHub (risco de supply chain julgado
menor que o de `docker/login-action`/`docker/build-push-action`,
mantidas pela Docker Inc.).

Esta spec estende o pin por SHA para as quatro actions, em ambos os
workflows onde aparecem. Decisão confirmada com o usuário via
`clarification-protocol` (ver `spec.md`, Clarificações).

*Justificativa*: o bump de major version já é obrigatório (Decisão 1);
o custo marginal de fixar por SHA em vez de por tag major é o mesmo
independente de quem mantém a action — um commit `# v7.0.1` ao lado do
SHA preserva a legibilidade que a tag major dava. Ganho: nenhuma action
do workflow depende de uma tag mutável que o mantenedor (GitHub ou
Docker Inc.) possa mover para apontar outro commit sem aviso — mesmo
que o risco julgado historicamente menor para actions first-party
continue válido em termos relativos, o custo de eliminar essa
diferença de tratamento é baixo o suficiente para não valer manter a
inconsistência.

**Alternativa rejeitada**: manter `actions/checkout`/`actions/setup-node`
em tag major (`@v7`), só resolvendo a depreciação sem tocar no pin.
Rejeitada porque foi a opção explicitamente **não** escolhida pelo
usuário na pergunta de clarificação do `/specify-tech` — registrado
aqui apenas para rastreabilidade da decisão, não como opção em aberto.

## Decisão 3 — Extensão de `scripts/validate-ci-workflow-shape.mjs`

A função `checkPinnedBySha(path, content, action)` já existe e é
genérica (recebe o nome da action como parâmetro) — não precisa ser
reescrita, só **chamada** para as duas actions novas, nos workflows
onde aparecem:

```js
// dentro do bloco "--- ci.yml ---"
checkPinnedBySha(CI_PATH, ciContent, "actions/checkout");
checkPinnedBySha(CI_PATH, ciContent, "actions/setup-node");

// dentro do bloco "--- publish-provider-aws.yml ---"
checkPinnedBySha(PUBLISH_PATH, publishContent, "actions/checkout");
```

`actions/setup-node` não aparece em `publish-provider-aws.yml` (esse
workflow não builda/testa código Node, só faz checkout + login GHCR +
build/push Docker) — nenhuma chamada nova ali.

*Justificativa*: reusa a mesma função que já valida `docker/login-action`/
`docker/build-push-action`, sem introduzir uma segunda forma de checar
a mesma coisa — consistente com o restante do script, que é
propositalmente baseado em regex sobre o texto do YAML, sem parser
(ver `specs/004-configurar-ci-path-providers/research.md`, seção
final, decisão original de não usar parser YAML).

## Decisão 4 — Comentário de versão ao lado do SHA

Seguir exatamente o formato já usado em `publish-provider-aws.yml`
para `docker/login-action`/`docker/build-push-action`:

```yaml
uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
```

`checkPinnedBySha` não valida o comentário (só o SHA antes do `@`) —
o comentário é convenção de legibilidade humana, não é imposto pelo
script. Manter de qualquer forma, por consistência com o padrão
existente no mesmo arquivo.

## Decisões descartadas por ora

- **Dependabot (ou Renovate) para manter actions atualizadas
  automaticamente**: resolveria a causa raiz de fundo (versões
  desatualizadas passarem despercebidas até um aviso de depreciação
  aparecer), mas é uma decisão de processo/tooling maior que uma
  action individual — registrada em `spec.md`, "Fora do escopo desta
  spec", como sugestão de trabalho futuro, não implementada aqui.
- **Atualizar `docker/login-action`/`docker/build-push-action` para
  versões mais recentes também**: fora do escopo — nenhuma delas
  apareceu no aviso original nem usa `node20` (ambas são actions
  compostas/Docker, não JavaScript — `runs.using` não se aplica da
  mesma forma). Confirmar isso não é necessário para esta spec: o
  aviso do GitHub já nomeou exatamente as duas actions afetadas.

## Verificação planejada (`/tasks` deve gerar tasks testáveis a partir disto)

1. `node scripts/validate-ci-workflow-shape.mjs` passa localmente após
   a mudança (gate "Testes de integração" de `.pipeline/quality-gates.md`).
2. Abrir um PR de teste contra `main` e inspecionar as Annotations da
   run de `ci.yml` — não deve aparecer "Node.js 20 is deprecated".
3. Confirmar, sem disparar um push real desnecessário, que
   `publish-provider-aws.yml` continua sintaticamente válido (YAML) e
   que `checkPinnedBySha` também cobre seu `actions/checkout` — a
   validação real de execução (`docker pull` etc.) só ocorre no
   próximo push legítimo que toque `providers/aws/**` ou
   `packages/contracts/**`, não é bloqueante para esta spec.

## Decisões durante a implementação

- As versões `v7.0.1`/`v7.0.0` resolvidas acima na Decisão 1 ainda
  eram as mais recentes no momento do `/implement` (mesma sessão,
  poucos minutos depois) — nenhuma reconciliação necessária.
- A mensagem de erro de `checkPinnedBySha` (`scripts/validate-ci-workflow-shape.mjs`)
  dizia "Action de terceiro deveria ser fixada por SHA..." — texto que
  ficou impreciso ao passar a cobrir `actions/checkout`/`actions/setup-node`
  (mantidas pela própria GitHub, não "de terceiro"). Ajustada durante
  T002 para um texto neutro ("deveria ser fixada por SHA...",
  mencionando a extensão desta spec), sem mudar a lógica de checagem —
  não estava previsto no plano, mas é uma correção de precisão direta
  na mesma função tocada pela task, não escopo novo.
- Evidência real do Critério de Aceite 4 (T007): PR
  [#16](https://github.com/eventpier/eventpier-monorepo/pull/16), run
  [32864927543](https://github.com/eventpier/eventpier-monorepo/actions/runs/32864927543)
  do job `validate`, conclusão `success` em 40s. Annotations da run
  (`gh api repos/eventpier/eventpier-monorepo/check-runs/97857735303/annotations`)
  retornou `[]` — nenhuma anotação, confirmando ausência total do
  aviso "Node.js 20 is deprecated" (não apenas "não apareceu entre as
  que eu vi": a lista está vazia).
