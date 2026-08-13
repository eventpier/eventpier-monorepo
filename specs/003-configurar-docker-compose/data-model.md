# Data Model — Docker Compose do MVP (003)

Esta spec não tem entidade de domínio (nenhum dado de negócio). O
"modelo" aqui é a topologia de serviços do Compose e as variáveis de
ambiente que atravessam a fronteira entre eles — conforme
`docs/arquitetura.md` §8, resolvido com as decisões técnicas de
`research.md`.

## Entidade: `Service` (serviço do Compose)

| Campo | Tipo | Descrição |
|---|---|---|
| `name` | string | Nome do serviço no Compose |
| `origin` | enum: `build` \| `image` | `build` = construído do código-fonte local; `image` = imagem publicada de terceiro |
| `network` | string | Sempre `eventpier-net` para os três serviços desta spec |
| `published_port` | string \| null | Porta publicada ao host (`host:container`); `null` = não alcançável fora da rede interna |
| `profile` | string \| null | Profile do Compose que precisa estar ativo para o serviço subir; `null` = sempre sobe |

## Instâncias

| `name` | `origin` | `published_port` | `profile` |
|---|---|---|---|
| `eventpier-ui` | `build` (`apps/ui/Dockerfile`) | `3000:3000` | `null` |
| `eventpier-aws` | `build` (`providers/aws/Dockerfile`) | `null` | `null` |
| `ministack` | `image` (`ministackorg/ministack:latest`) | `4566:4566` | `managed-env` |

**Invariante (constitution, princípios 7 e 11)**: `eventpier-aws` nunca
tem `published_port` — é alcançável apenas por `eventpier-ui` dentro de
`eventpier-net`. Qualquer task que adicione uma seção `ports:` a
`eventpier-aws` viola esta spec.

## Entidade: `EnvVar` (variável de ambiente passada a um serviço)

| Campo | Tipo | Descrição |
|---|---|---|
| `service` | string | Serviço que recebe a variável |
| `name` | string | Nome da variável |
| `default` | string | Valor default quando não sobrescrita |
| `overridable_via` | string | Mecanismo de override disponível ao desenvolvedor |

## Instâncias

| `service` | `name` | `default` | `overridable_via` |
|---|---|---|---|
| `eventpier-ui` | `EVENTPIER_AWS_URL` | `http://eventpier-aws:4000` | fixo — não faz sentido sobrescrever, é sempre o DNS interno do Compose |
| `eventpier-aws` | `MINISTACK_ENDPOINT` | `http://ministack:4566` | `.env` na raiz (ver `.env.example`) ou variável de ambiente do shell antes de `docker compose up` |
| `eventpier-aws` | `MINISTACK_MANAGED` | `true` | idem acima |
| `eventpier-aws` | `HEALTH_CHECK_TTL_MS` | `4000` | idem acima |

**Invariante**: nenhuma das variáveis acima carrega segredo/credencial
— consistente com a constitution, princípio 10 (sem autenticação em
ambientes locais). Se uma spec futura (fora do MVP) introduzir
autenticação, essa invariante precisa ser reaberta.

## Entidade: `PlaceholderServer` (conteúdo temporário desta spec)

| Campo | Tipo | Descrição |
|---|---|---|
| `workspace` | string | Workspace dono do placeholder |
| `port` | number | Porta em que o servidor escuta |
| `replaced_by` | string | Spec que substitui integralmente este conteúdo |

## Instâncias

| `workspace` | `port` | `replaced_by` |
|---|---|---|
| `apps/ui` | 3000 | spec 009 (skeleton Next.js) |
| `providers/aws` | 4000 | spec 005 (endpoint de manifesto) |

**Invariante**: nenhum `PlaceholderServer` deve ganhar lógica de
negócio, rota adicional ou dependência de runtime nova — o único
objetivo é a porta responder, para o Compose ser validável (ver
`research.md`, Decisão 3). Qualquer necessidade além disso pertence às
specs listadas em `replaced_by`.

## Relacionamentos

```text
eventpier-ui  --(EVENTPIER_AWS_URL, rede eventpier-net)-->  eventpier-aws
eventpier-aws --(MINISTACK_ENDPOINT, rede eventpier-net)-->  ministack (quando managed=true)
eventpier-aws --(MINISTACK_ENDPOINT=http://host.docker.internal:*, extra_hosts)--> MiniStack externo (quando managed=false)
```

## Fora do escopo deste modelo

- Nenhuma entidade de domínio real (`Bucket`, `StorageObject`,
  `ProviderManifest`, etc.) — essas já existem em
  `specs/002-definir-contrato-compartilhado/data-model.md` e não são
  tocadas por esta spec.
- Nenhum modelo de dado do MiniStack em si — é um serviço de terceiro,
  tratado como caixa-preta além do endpoint/porta documentados.
