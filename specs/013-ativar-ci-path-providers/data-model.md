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

## Instâncias esperadas (preenchidas durante `/implement`)

| `requirement` | `evidence_type` | `link_or_command` |
|---|---|---|
| FR1 | `pr_blocked` | PR de teste com `tsc` quebrado — `mergeStateStatus: BLOCKED` |
| FR2 | `workflow_run` | run de `publish-provider-aws.yml` disparado pelo merge de `providers/aws/README.md` |
| FR3 | `docker_pull` | `docker pull ghcr.io/eventpier/eventpier-aws:latest` sem login |
| FR4a | `workflow_run` | PR só em `apps/ui/README.md` — nenhum run de publish nos checks |
| FR4b | `workflow_run` | mesmo run de FR2 |
| FR4c | `workflow_run` | run de `publish-provider-aws.yml` disparado pelo merge de `packages/contracts/README.md` |

## Fora do escopo deste modelo

- Nenhuma mudança na forma de `ci.yml`/`publish-provider-aws.yml`
  (`Workflow`/`ProviderPublishTarget` já modelados em
  `specs/004-configurar-ci-path-providers/data-model.md`, inalterados
  aqui).
