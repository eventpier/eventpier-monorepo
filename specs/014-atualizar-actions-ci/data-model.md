# Data Model — Atualizar actions/checkout e actions/setup-node (014)

Esta spec não tem entidade de domínio. O "modelo" é o conjunto de
actions de terceiro/first-party usadas nos workflows de CI e como cada
uma é fixada — resolvido pelas decisões de `research.md`.

## Entidade: `PinnedAction` (uma referência `uses:` dentro de um workflow)

| Campo | Tipo | Descrição |
|---|---|---|
| `workflow` | string | Arquivo em `.github/workflows/` onde a referência aparece |
| `action` | string | Nome da action (`org/repo`) |
| `pin_type` | enum: `sha40` \| `tag` | Como a versão é fixada |
| `ref` | string | SHA de 40 chars (se `pin_type = sha40`) ou tag (se `tag`) |
| `version_comment` | string \| null | Comentário `# vX.Y.Z` ao lado do pin, quando `pin_type = sha40` |
| `runtime` | enum: `node20` \| `node24` \| `n/a` | `runs.using` declarado no `action.yml` da versão referenciada; `n/a` para actions não-JavaScript (Docker/composite) |

**Invariante (Critério de Aceite 1 e 2 de `spec.md`)**: toda instância
com `runtime = node20` é um estado inválido após esta spec — todas as
linhas da tabela abaixo devem ter `runtime = node24` (ou `n/a`) e
`pin_type = sha40` no estado-alvo.

## Instâncias — estado atual (antes desta spec)

| `workflow` | `action` | `pin_type` | `ref` | `version_comment` | `runtime` |
|---|---|---|---|---|---|
| `ci.yml` | `actions/checkout` | `tag` | `v4` | — | `node20` |
| `ci.yml` | `actions/setup-node` | `tag` | `v4` | — | `node20` |
| `publish-provider-aws.yml` | `actions/checkout` | `tag` | `v4` | — | `node20` |
| `publish-provider-aws.yml` | `docker/login-action` | `sha40` | `c94ce9fb468520275223c153574b00df6fe4bcc9` | `# v3.7.0` | `n/a` (Docker action) |
| `publish-provider-aws.yml` | `docker/build-push-action` | `sha40` | `10e90e3645eae34f1e60eeb005ba3a3d33f178e8` | `# v6.19.2` | `n/a` (Docker action) |

## Instâncias — estado-alvo (após esta spec)

| `workflow` | `action` | `pin_type` | `ref` | `version_comment` | `runtime` |
|---|---|---|---|---|---|
| `ci.yml` | `actions/checkout` | `sha40` | `3d3c42e5aac5ba805825da76410c181273ba90b1` | `# v7.0.1` | `node24` |
| `ci.yml` | `actions/setup-node` | `sha40` | `820762786026740c76f36085b0efc47a31fe5020` | `# v7.0.0` | `node24` |
| `publish-provider-aws.yml` | `actions/checkout` | `sha40` | `3d3c42e5aac5ba805825da76410c181273ba90b1` | `# v7.0.1` | `node24` |
| `publish-provider-aws.yml` | `docker/login-action` | `sha40` | `c94ce9fb468520275223c153574b00df6fe4bcc9` | `# v3.7.0` | `n/a` (inalterado) |
| `publish-provider-aws.yml` | `docker/build-push-action` | `sha40` | `10e90e3645eae34f1e60eeb005ba3a3d33f178e8` | `# v6.19.2` | `n/a` (inalterado) |

`ci.yml` mantém `with: { node-version: "24" }` no step `actions/setup-node`
— esse input não muda; ele controla o runtime do **build do projeto**,
não o runtime da action em si (ver `spec.md`, seção Problema, para a
distinção entre os dois "Node 24").

## Relacionamentos

```text
scripts/validate-ci-workflow-shape.mjs
  │
  ├─ checkPinnedBySha(ci.yml, "actions/checkout")     [novo nesta spec]
  ├─ checkPinnedBySha(ci.yml, "actions/setup-node")    [novo nesta spec]
  ├─ checkPinnedBySha(publish-provider-aws.yml, "actions/checkout")        [novo nesta spec]
  ├─ checkPinnedBySha(publish-provider-aws.yml, "docker/login-action")     [já existia, spec 004]
  └─ checkPinnedBySha(publish-provider-aws.yml, "docker/build-push-action") [já existia, spec 004]
```

## Fora do escopo deste modelo

- `docker/login-action`/`docker/build-push-action`: linhas mantidas na
  tabela só para mostrar o padrão já existente sendo seguido — nenhuma
  mudança de versão nelas nesta spec (ver `research.md`, "Decisões
  descartadas por ora").
- Qualquer entidade de domínio do produto (`Bucket`, `ProviderManifest`,
  etc.) — inalteradas por esta spec.
