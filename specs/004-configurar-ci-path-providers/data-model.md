# Data Model — CI com Gatilho por Path (004)

Esta spec não tem entidade de domínio (nenhum dado de negócio). O
"modelo" aqui é a topologia de workflows de CI e os gatilhos que
determinam quando cada um roda — resolvido com as decisões técnicas de
`research.md`.

## Entidade: `Workflow` (arquivo em `.github/workflows/`)

| Campo | Tipo | Descrição |
|---|---|---|
| `file` | string | Caminho do arquivo do workflow |
| `trigger_event` | enum: `pull_request` \| `push` | Evento que dispara o workflow |
| `trigger_branches` | string[] | Branches-alvo do evento |
| `path_filter` | string[] \| null | Filtro de path do gatilho; `null` = roda para qualquer mudança |
| `permissions` | object | Permissões mínimas do `GITHUB_TOKEN` concedidas ao job |

## Instâncias

| `file` | `trigger_event` | `trigger_branches` | `path_filter` | `permissions` |
|---|---|---|---|---|
| `.github/workflows/ci.yml` | `pull_request` | `[main]` | `null` | `{ contents: read }` |
| `.github/workflows/publish-provider-aws.yml` | `push` | `[main]` | `["providers/aws/**", "packages/contracts/**"]` | `{ contents: read, packages: write }` |

**Invariante (spec.md, requisito funcional 1)**: `ci.yml` nunca ganha
`path_filter` — precisa continuar cobrindo qualquer PR, independente
do workspace alterado. Qualquer task que adicione um filtro de path a
`ci.yml` viola este requisito.

**Invariante (spec.md, requisitos funcionais 3-4)**: todo workflow
`publish-provider-<nome>.yml` futuro deve incluir
`packages/contracts/**` em seu `path_filter`, além de
`providers/<nome>/**` — nunca apenas o path do próprio provider. Ver
`research.md`, Decisão 3.

## Entidade: `ProviderPublishTarget` (o que cada workflow de publish produz)

| Campo | Tipo | Descrição |
|---|---|---|
| `provider_id` | string | Identificador do provider (ex.: `aws`) |
| `dockerfile` | string | Dockerfile usado no build (já existente, spec 003) |
| `image` | string | Repositório da imagem no registry |
| `tags` | string[] | Tags aplicadas a cada publish |
| `platform` | string | Plataforma(s) de build |

## Instâncias

| `provider_id` | `dockerfile` | `image` | `tags` | `platform` |
|---|---|---|---|---|
| `aws` | `providers/aws/Dockerfile` | `ghcr.io/eventpier/eventpier-aws` | `["sha-<7 chars do commit>", "latest"]` | `linux/amd64` |

**Invariante**: `tags` sempre inclui uma tag rastreável ao commit
(`sha-<7 chars>`) — nunca apenas `latest` sozinha (spec.md, requisito
funcional 6).

## Relacionamentos

```text
push em main
  │
  ├─ toca providers/aws/** e/ou packages/contracts/**?
  │     sim → publish-provider-aws.yml builda + publica ProviderPublishTarget(aws)
  │     não → nenhum workflow de publish roda
  │
pull_request contra main (qualquer path)
  └─ ci.yml roda os quality gates de .pipeline/quality-gates.md
       sobre o monorepo inteiro, sempre — bloqueia merge se falhar
```

## Fora do escopo deste modelo

- Nenhuma entidade de domínio do produto (`Bucket`, `ProviderManifest`,
  etc.) — inalteradas por esta spec.
- Nenhum modelo de deploy/rollout da imagem publicada — fora do escopo
  desta spec (ver `spec.md`, "Fora do escopo desta spec").
- `ProviderPublishTarget` para providers além de `aws` — não existem
  ainda; a tabela ganha uma linha nova quando um provider real for
  adicionado, sem mudança de estrutura.
