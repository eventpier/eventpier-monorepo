# Contrato — Forma dos Workflows de CI (004)

Esta spec não expõe API HTTP. O "contrato" aqui é a forma exata que
`/tasks`/`/implement` devem produzir para os workflows de CI —
referência normativa: `research.md` desta spec, decisões 1-6.

## `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "24"

      - name: Enable Corepack (pnpm)
        run: |
          corepack enable
          corepack prepare pnpm@11.10.0 --activate

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm -r exec tsc --noEmit

      - name: Build
        run: |
          pnpm --filter @eventpier/contracts build
          pnpm --filter @eventpier/provider-aws build
          pnpm --filter @eventpier/ui build

      - name: Docker build
        run: docker compose build

      - name: Testes (scripts de validação estrutural)
        run: |
          node scripts/validate-workspace-manifests.mjs
          node scripts/validate-workspace-dependencies.mjs
          node scripts/validate-contract-constants.mjs
          node scripts/validate-compose-shape.mjs
          node scripts/validate-ci-workflow-shape.mjs
```

## `.github/workflows/publish-provider-aws.yml`

```yaml
name: Publish provider — aws

on:
  push:
    branches: [main]
    paths:
      - "providers/aws/**"
      - "packages/contracts/**"

permissions:
  contents: read
  packages: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set image tag (short sha)
        id: vars
        run: echo "sha_tag=sha-${GITHUB_SHA::7}" >> "$GITHUB_OUTPUT"

      - name: Log in to GHCR
        uses: docker/login-action@c94ce9fb468520275223c153574b00df6fe4bcc9 # v3.7.0
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@10e90e3645eae34f1e60eeb005ba3a3d33f178e8 # v6.19.2
        with:
          context: .
          file: providers/aws/Dockerfile
          push: true
          platforms: linux/amd64
          tags: |
            ghcr.io/eventpier/eventpier-aws:${{ steps.vars.outputs.sha_tag }}
            ghcr.io/eventpier/eventpier-aws:latest
```

## Validação esperada (para `/tasks` gerar tasks testáveis)

- Ambos os arquivos existem em `.github/workflows/` e são YAML
  válido.
- `ci.yml`:
  - gatilho é `pull_request` contra `main`, **sem** chave `paths:`
    (requisito funcional 1 — cobre todo PR, qualquer workspace).
  - declara `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`
    — cancela runs supersedidos por pushes sucessivos na mesma PR
    (achado do review da PR #6).
  - executa, nesta ordem, os quatro gates de
    `.pipeline/quality-gates.md` (Typecheck, Build, Docker, Testes) —
    incluindo `node scripts/validate-ci-workflow-shape.mjs` na lista
    de Testes (esta própria spec se valida).
- `publish-provider-aws.yml`:
  - gatilho é `push` (não `pull_request`) para `branches: [main]`, com
    `paths:` contendo exatamente `providers/aws/**` e
    `packages/contracts/**` (requisitos funcionais 3, 4, 5).
  - `permissions.packages` é `write`; nenhum segredo além de
    `secrets.GITHUB_TOKEN` é referenciado (requisito funcional 8).
  - a lista de `tags:` do `docker/build-push-action` contém uma tag
    derivada de `GITHUB_SHA` (requisito funcional 6) e a tag `latest`.
  - `file:` aponta para `providers/aws/Dockerfile` (o mesmo Dockerfile
    já validado por `specs/003-configurar-docker-compose`), `context:`
    é `.` (raiz do monorepo).
  - `docker/login-action` e `docker/build-push-action` são fixados por
    SHA de commit completo (40 chars hex), não por tag mutável (`@v3`/
    `@v6`) — achado do review da PR #6 (risco de supply chain para um
    job com `packages: write`). `actions/checkout`/`actions/setup-node`
    (primeira parte, mantidos pela própria GitHub) continuam pinados
    por tag major — o risco que motivou a mudança é específico de
    Actions de terceiro.

`scripts/validate-ci-workflow-shape.mjs` (criado por esta spec) checa
os pontos acima lendo os dois arquivos YAML como texto (sem
dependência de parser YAML — ver `research.md`, seção final) e
aplicando as mesmas asserções descritas nesta lista.
