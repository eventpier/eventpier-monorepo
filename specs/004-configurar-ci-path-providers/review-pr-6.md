# Review — PR #6: CI com gatilho por path para providers/* (spec 004)

```yaml
quality_gates:
  typecheck: pass
  build: pass
  docker: pass
  test: pass
  lint: not_run   # ainda não configurado no projeto (quality-gates.md)
  ci_real_no_github: pass   # job "validate" rodou na própria PR e passou (SUCCESS)
review_judgment:
  security: flagged
  architecture: pass
  functionality: flagged
  quality: flagged
```

## Resumo executivo

A PR entrega exatamente o que `spec.md`/`tasks.md` prometiam: `ci.yml`
valida todo PR sem filtro de path, `publish-provider-aws.yml` publica
a imagem do provider AWS no GHCR com gatilho por path
(`providers/aws/**` + `packages/contracts/**`), e o shape validator
(`scripts/validate-ci-workflow-shape.mjs`) já confirmou GREEN
localmente e o job `validate` real já passou nesta própria PR no
GitHub Actions. A decisão de rodar o publish em `push` (não
`pull_request`) para não virar um required status check "pendente
para sempre" é bem fundamentada. Os 12/12 tasks estão marcados,
`research.md` documenta decisões e trade-offs com profundidade
incomum (inclusive alternativas rejeitadas), e os três follow-ups
manuais pós-merge (branch protection, visibilidade do pacote GHCR,
confirmação real do gatilho) já estavam registrados no corpo da
própria PR antes do review — nada foi escondido.

Três ressalvas, nenhuma bloqueante.

## Comentários por arquivo

### `.github/workflows/publish-provider-aws.yml`

**[MÉDIO] Actions de terceiro fixadas por tag mutável, não por SHA**
> Linha 26 (`docker/login-action@v3`) e linha 33 (`docker/build-push-action@v6`)

Este job tem `permissions.packages: write`. Se a tag `@v6`/`@v3` for
movida no upstream (conta do publisher comprometida), o próximo push
que tocar `providers/aws/**` ou `packages/contracts/**` executa esse
código automaticamente com permissão de publicar no GHCR da
organização.

**Sugestão:** fixar por SHA completo (`docker/build-push-action@<sha>
# v6.x.x`), idealmente com Dependabot configurado para abrir PR
quando a Action for atualizada.

---

**[MÉDIO] Política de criação de pacotes da organização não verificada**
> Geral no arquivo

Publicar em `ghcr.io/eventpier/...` (namespace da org) via
`GITHUB_TOKEN` padrão depende da política "Package creation" de
Actions estar habilitada nas configurações da organização
`eventpier`. Não estava na lista de follow-ups do corpo da PR até
este review.

**Sugestão:** confirmar em Organization Settings → Actions/Packages
que a criação de pacotes por workflow está permitida, antes de
depender do primeiro publish real — evita descobrir isso só quando
falhar com 403.

---

### `.github/workflows/ci.yml`

**[BAIXO] Sem `concurrency` guard**
> Geral no arquivo

Pushes sucessivos numa mesma PR deixam runs anteriores rodando até o
fim em vez de cancelar — desperdício de minutos de Actions sem
necessidade, especialmente relevante em repositório público.

**Sugestão (opcional, não bloqueante):**
```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

## Diagnóstico geral

| # | Arquivo | Severidade | Título |
|---|---------|------------|--------|
| 1 | `.github/workflows/publish-provider-aws.yml` | Médio | Actions de terceiro fixadas por tag, não por SHA |
| 2 | `.github/workflows/publish-provider-aws.yml` | Médio | Política de criação de pacotes da org não verificada |
| 3 | `.github/workflows/ci.yml` | Baixo | Sem concurrency guard |

## Recomendação de merge

**Aprovar com ressalvas** — apenas médios/baixos, nenhum crítico/alto
bloqueante.

## Fechamento da feature

Incluído nesta mesma PR (commit "docs(configurar-ci-path-providers):
mark feature as complete"):

- `.pipeline/state/configurar-ci-path-providers.json`: `current_phase` → `done`.
- `.pipeline/roadmap.md`: linha 004 → ✅ Concluído.
- `.pipeline/decisions-log.md`: nova entrada "004-configurar-ci-path-providers".
- `docs/features/ci.md` (novo): documentação de domínio do módulo CI.
- `docs/features/docker-compose.md`: corrige menção desatualizada à
  spec 004 como inexistente.

## Aprovação

Aprovado pelo usuário no chat em 2026-08-13 (opção 1 — "submeter como
está"). Review submetido ao GitHub como `event=COMMENT` (não
`APPROVE`): o autor da PR é o mesmo usuário autenticado no GitHub
(`edenoscherer`), e a API do GitHub bloqueia autoaprovação — a
aprovação real já aconteceu neste chat. `state` da review no GitHub
fica `COMMENTED`, não `APPROVED`; isso não muda a recomendação acima.
