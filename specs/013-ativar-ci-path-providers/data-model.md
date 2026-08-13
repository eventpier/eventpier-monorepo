# Data Model — Ativação Operacional do CI (013)

Esta spec não tem entidade de domínio. O "modelo" é a regra de
proteção adicionada ao Ruleset existente e as evidências que provam
cada requisito funcional — resolvido pelas decisões de `research.md`.

## Entidade: `RulesetRule` (regra dentro do Ruleset `20759671`)

| Campo | Tipo | Descrição |
|---|---|---|
| `type` | string | Tipo da regra (`pull_request`, `non_fast_forward`, `deletion` — já existentes; `required_status_checks` — nova) |
| `context` | string \| null | Nome do check exigido (só para `required_status_checks`) |

## Instância nova

| `type` | `context` |
|---|---|
| `required_status_checks` | `validate` |

**Invariante**: as três regras já existentes (`pull_request`,
`non_fast_forward`, `deletion`) devem permanecer inalteradas — o PUT
ao Ruleset (Decisão 1) é aditivo, nunca substitui a configuração
atual de aprovação/merge methods.

## Entidade: `RequirementEvidence` (prova de cada requisito funcional)

| Campo | Tipo | Descrição |
|---|---|---|
| `requirement` | string | Requisito funcional de `spec.md` (FR1-FR5) |
| `evidence_type` | enum: `pr_blocked` \| `workflow_run` \| `docker_pull` | Como foi verificado |
| `link_or_command` | string | URL do run/PR, ou comando executado |

## Instâncias (evidência real, coletada durante `/implement`)

| `requirement` | `evidence_type` | `link_or_command` |
|---|---|---|
| FR1 | `pr_blocked` | [PR #7](https://github.com/eventpier/eventpier-monorepo/pull/7) — antes de T003: `mergeStateStatus: UNSTABLE`/`mergeable: MERGEABLE` com `validate` em `FAILURE` (nada bloqueava); depois de T003: `mergeStateStatus: BLOCKED`. PR fechado sem merge. |
| FR2 | `workflow_run` | [run 31708427656](https://github.com/eventpier/eventpier-monorepo/actions/runs/31708427656) — disparado pelo merge de [PR #9](https://github.com/eventpier/eventpier-monorepo/pull/9) (`providers/aws/README.md`), `conclusion: success`. Primeira publicação real, sem fallback de permissão necessário (Decisão 2 do research.md — política da org já permitia criação). |
| FR3 | `docker_pull` | `docker pull ghcr.io/eventpier/eventpier-aws:latest` — sucesso, sem `docker login` prévio, após o usuário habilitar "public packages" na política da organização (`settings/packages`) e marcar o pacote como público (achado não previsto — ver research.md, "Decisões durante a implementação"). |
| FR4a | `workflow_run` | [PR #8](https://github.com/eventpier/eventpier-monorepo/pull/8) (`apps/ui/README.md`) mergeado — `gh run list` após o merge não mostra nenhum run de "Publish provider — aws". |
| FR4b | `workflow_run` | mesmo run de FR2. |
| FR4c | `workflow_run` | [run 31710028747](https://github.com/eventpier/eventpier-monorepo/actions/runs/31710028747) — disparado pelo merge de [PR #10](https://github.com/eventpier/eventpier-monorepo/pull/10) (`packages/contracts/README.md`, sem tocar `providers/`), `conclusion: success`. |
| FR4 (rastreabilidade) | `docker_pull` | `docker pull ghcr.io/eventpier/eventpier-aws:sha-5890dec` — sucesso; `5890dec` é exatamente o commit de merge do PR #10 (`git log`), confirmando a tag `sha-<7 chars>` rastreável ao commit de origem. |

## Fora do escopo deste modelo

- Nenhuma mudança na forma de `ci.yml`/`publish-provider-aws.yml`
  (`Workflow`/`ProviderPublishTarget` já modelados em
  `specs/004-configurar-ci-path-providers/data-model.md`, inalterados
  aqui).
