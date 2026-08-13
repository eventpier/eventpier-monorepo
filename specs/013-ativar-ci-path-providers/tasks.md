# Tasks — Ativação Operacional do CI (013)

Fonte: `spec.md` (requisitos funcionais FR1-FR5), `plan`/`research.md`
(decisões 1-4), `data-model.md` (entidades `RulesetRule`,
`RequirementEvidence`), `quickstart.md` (Fases 1-6). Sem `contracts/`
— esta spec não introduz forma de arquivo/API nova.

**Nota de natureza das tasks**: diferente das specs 001-004, a maioria
das tasks aqui não edita arquivo de código — ela executa ações reais
contra o GitHub (Rulesets API, PRs, merges, package settings) e
registra evidência. Onde aplicável, mantém o espírito TDD: T002
estabelece o estado RED (bloqueio não funciona ainda) antes de T003
(a mudança) e T006 confirma GREEN com a mesma verificação.

`[P]` = paralelizável. Sem marcador = sequencial (a maioria — cada
task depende do estado real deixado pela anterior no GitHub).

**⚠ Ações que escrevem no GitHub de forma visível/difícil de reverter**
(research.md, "Segurança e Observabilidade"): T003 (muda proteção de
`main`), T004/T005/T010 (merges reais em `main`). Confirmar com o
usuário antes de executar este bloco, mesmo em `MODO_EXECUCAO:
encadeado` — não é dispensado automaticamente.

## Fase: Setup

- [ ] **T001** Confirmar estado atual antes de qualquer mudança:
  `gh api repos/eventpier/eventpier-monorepo/rulesets/20759671` tem
  exatamente as 3 regras já conhecidas (sem `required_status_checks`
  ainda); `apps/ui/README.md`, `providers/aws/README.md`,
  `packages/contracts/README.md` não existem; branch local
  `feature/013-ativar-ci-path-providers` está a partir de `main`
  atualizada.
  _Origem: research.md, Decisão 1 (achado do 404/ruleset); Decisão 3._

## Fase: Testes

- [ ] **T002** Estado RED do Requisito 1: criar branch de teste a
  partir de `main`, quebrar `pnpm -r exec tsc --noEmit` de propósito
  num arquivo qualquer, abrir PR contra `main`. Aguardar `ci.yml`
  falhar. Confirmar `gh pr view <N> --json mergeStateStatus` **não**
  reporta `BLOCKED` hoje (confirma a lacuna antes da correção). Deixar
  o PR aberto — será reusado em T006, não mergeado nunca.
  _Origem: spec.md, Requisito Funcional 1; research.md, Decisão 1 ("verificação, não só configuração")._

## Fase: Core

- [ ] **T003** ⚠ Adicionar a regra `required_status_checks`
  (`context: "validate"`) ao Ruleset `20759671` via `PUT`, preservando
  as 3 regras existentes — payload exato em `research.md`, Decisão 1.
  _Origem: spec.md, Requisito Funcional 1; data-model.md (`RulesetRule`)._

- [ ] **T004** ⚠ Criar `apps/ui/README.md` mínimo (breve descrição do
  workspace, seu estado atual de placeholder). Abrir PR isolado
  (só este arquivo), aguardar `ci.yml` passar, mergear em `main`.
  _Origem: spec.md, Requisito Funcional 4 (cenário "apps/ui-only"); research.md, Decisão 3, passo 1._

- [ ] **T005** ⚠ Criar `providers/aws/README.md` mínimo. Abrir PR
  isolado, aguardar `ci.yml` passar, mergear em `main` — este merge é
  o gatilho da primeira publicação real.
  _Origem: spec.md, Requisitos Funcionais 2, 4 (cenário "providers/aws"); research.md, Decisão 3, passo 2._

- [ ] **T006** Re-confirmar T002 agora com a regra de T003 ativa:
  `gh pr view <N do T002> --json mergeStateStatus` deve reportar
  `BLOCKED` (GREEN). Fechar o PR de T002 **sem mergear** e deletar sua
  branch.
  _Valida: T002, T003; spec.md Critério de Sucesso 1._

## Fase: Integração

Sequencial — cada task assume o resultado real da anterior no GitHub.

- [ ] **T007** Confirmar o resultado do run de `publish-provider-aws.yml`
  disparado por T005:
  - Se `SUCCESS`: Requisito Funcional 2 satisfeito, seguir para T008.
  - Se falhou por permissão (403): seguir o fallback de
    `research.md`, Decisão 2 (Organization Settings → Packages →
    "Package creation" → habilitar) e usar `gh run rerun <run-id>`
    até obter `SUCCESS` antes de prosseguir.
  _Valida: spec.md Requisito Funcional 2; data-model.md (`RequirementEvidence` FR2)._

- [ ] **T008** Pedir ao usuário para marcar o pacote
  `eventpier-aws` do GHCR como público
  (`github.com/orgs/eventpier/packages/container/eventpier-aws/settings`
  → Change visibility → Public) — ação manual, token atual sem escopo
  `write:packages` (research.md, Decisão 4). Aguardar confirmação
  antes de prosseguir para T009.
  _Origem: spec.md, Requisito Funcional 3; research.md, Decisão 4._

- [ ] **T009** De uma sessão sem `docker login ghcr.io`, rodar
  `docker pull ghcr.io/eventpier/eventpier-aws:latest`. Confirmar
  sucesso sem prompt de autenticação.
  _Valida: spec.md Requisito Funcional 3, Critério de Sucesso 2; data-model.md (`RequirementEvidence` FR3)._

- [ ] **T010** ⚠ Criar `packages/contracts/README.md` mínimo (sem
  tocar `providers/`). Abrir PR isolado, aguardar `ci.yml` passar,
  mergear em `main`. Confirmar que `publish-provider-aws.yml` dispara
  de novo mesmo sem mudança em `providers/aws/**`.
  _Origem: spec.md, Requisito Funcional 4 (cenário "contracts-only"); research.md, Decisão 3, passo 3._

## Fase: Polish

- [ ] **T011** Preencher a tabela `RequirementEvidence` de
  `data-model.md` com os links reais (PRs, runs) observados em
  T002-T010.

- [ ] **T012** `[P]` Preencher `research.md` → "Decisões durante a
  implementação" com qualquer decisão não prevista (ex.: se o
  fallback de permissão da Decisão 2 foi de fato necessário).

- [ ] **T013** Revisão final contra `spec.md` → "Critérios de
  Sucesso": confirmar os três critérios com a evidência registrada em
  T011, e preparar o resumo para `/review-pr` (quais requisitos têm
  evidência real de execução, não apenas configuração).
