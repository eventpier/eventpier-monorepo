# Quickstart — Validação manual (004)

Passos para confirmar que o CI está correto. Diferente das specs
anteriores, parte desta validação só é observável no GitHub (Actions
rodando de verdade) — não é possível simular `pull_request`/`push`
localmente sem uma ferramenta de terceiro (deliberadamente não
introduzida, ver `research.md`). Este quickstart separa o que dá para
checar antes de empurrar (Fases 1-2) do que só se confirma depois
(Fases 3-4).

## Fase 1 — Os quality gates de `ci.yml` já passam localmente

Os mesmos comandos que `ci.yml` roda, executados manualmente:

```bash
pnpm install --frozen-lockfile
pnpm -r exec tsc --noEmit
pnpm --filter @eventpier/contracts build
pnpm --filter @eventpier/provider-aws build
pnpm --filter @eventpier/ui build
docker compose build
node scripts/validate-workspace-manifests.mjs
node scripts/validate-workspace-dependencies.mjs
node scripts/validate-contract-constants.mjs
node scripts/validate-compose-shape.mjs
node scripts/validate-ci-workflow-shape.mjs
```

**Esperado**: todos os comandos terminam com exit code 0 — se algum
falhar aqui, `ci.yml` falhará exatamente da mesma forma no GitHub.

## Fase 2 — Forma dos workflows bate com o contrato

```bash
node scripts/validate-ci-workflow-shape.mjs
```

**Esperado**: confirma que `ci.yml` não tem `paths:` no gatilho e que
`publish-provider-aws.yml` tem `paths: [providers/aws/**,
packages/contracts/**]`, roda em `push` (não `pull_request`), e usa
apenas `secrets.GITHUB_TOKEN` — ver
`contracts/ci-workflow-shape.md`, seção "Validação esperada".

## Fase 3 — Comportamento real no GitHub, após o merge desta spec

Estes passos só fazem sentido depois que esta spec estiver mergeada em
`main` (branch protection já ativa, `main` protegida — ver memória do
projeto).

1. Abra um PR que só altera `apps/ui/**` (ex.: um comentário).
   **Esperado**: `ci.yml` roda e passa; nenhum job de publish é
   disparado (nem aparece na lista de checks do PR).
2. Abra um PR que altera `providers/aws/**` e faça merge em `main`.
   **Esperado**: logo após o merge, `publish-provider-aws.yml` aparece
   em Actions, builda e finaliza com sucesso.
3. Confirme a imagem publicada:
   ```bash
   gh api /orgs/eventpier/packages/container/eventpier-aws/versions --jq '.[0].metadata.container.tags'
   ```
   **Esperado**: a lista inclui `latest` e uma tag `sha-<7 chars>`
   correspondente ao commit de merge em `main`.
4. Abra um PR que altera **apenas** `packages/contracts/**` (nenhum
   arquivo de `providers/`) e faça merge.
   **Esperado**: `publish-provider-aws.yml` dispara mesmo assim — o
   provider AWS é republicado por depender do contrato (requisito
   funcional 3-4 de `spec.md`).
5. Confirme que um PR com um gate quebrado (ex.: introduzir um erro de
   tipo temporário) não pode ser mergeado enquanto `ci.yml` não
   passar — branch protection deve recusar o merge.

## Fase 4 — Tornar o pacote GHCR público (ação manual única)

Após a primeira publicação (Fase 3, passo 2), o pacote
`eventpier-aws` nasce **privado** no GHCR, independente do repositório
ser público (ver `research.md`, Decisão 5 — comportamento documentado
do GitHub, não um bug desta spec).

1. No GitHub, acesse a página do pacote:
   `github.com/orgs/eventpier/packages/container/eventpier-aws`.
2. **Package settings** → **Change visibility** → **Public**.

**Esperado**: a partir daí, `docker pull ghcr.io/eventpier/eventpier-aws:latest`
funciona sem autenticação, de qualquer máquina. Este passo é manual e
único — não faz parte de nenhum workflow automatizado (ver
`research.md`, Decisão 5, para o motivo de não ser automatizável sem
violar o requisito funcional 8 da spec).

## Fase 5 — Confirmar que nada além do previsto foi tocado

```bash
git status --short
```

**Esperado**: mudanças restritas a `.github/workflows/ci.yml`,
`.github/workflows/publish-provider-aws.yml`,
`scripts/validate-ci-workflow-shape.mjs` e
`.pipeline/quality-gates.md`. Nenhuma mudança em `docker-compose.yml`
(Decisão 7 de `research.md`), nenhuma mudança em
`packages/contracts/src/` (só a superfície de CI a consome, não a
altera).
