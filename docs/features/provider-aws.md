# Provider AWS — `providers/aws`

## O que o módulo faz

`providers/aws` (`@eventpier/provider-aws`) é o provider AWS do
Eventpier: expõe capabilities do MiniStack via um manifesto HTTP
consumido pela UI. Hoje expõe apenas o manifesto do provider — nenhuma
capability real (Storage) ainda.

## Comportamentos-chave e regras de negócio

- `GET /api/v1/manifest` retorna o `ProviderManifest` do provider
  (`contractVersion`, `provider`, `environment`, `version`,
  `capabilities`) — ver "Contrato de API" abaixo.
- `contractVersion` é sempre lido em runtime de `CONTRACT_VERSION`
  (`@eventpier/contracts`), nunca duplicado como literal no provider.
- `version` é sempre lido do próprio `providers/aws/package.json` em
  runtime (`readFileSync`), nunca hardcoded — evita divergir do
  `package.json` real a cada bump de versão.
- `provider` é sempre fixo (`{ id: "aws", name: "AWS" }`) — este
  provider só representa AWS.
- `environment` é fixo nesta versão (`{ id: "ministack", managed:
  true }`, sem `endpoint`) — configurabilidade real (endpoint
  externo, `managed: false`) é escopo da spec 007
  (`EnvironmentConfig`), ainda não implementada.
- `capabilities` é sempre `[]` nesta versão — nenhuma capability real
  está implementada ainda (Storage é spec 008; health-check com cache
  é spec 006). Uma lista vazia comunica "provider não implementa
  capability nenhuma ainda", distinto de "capability implementada mas
  indisponível agora" (constitution, princípio 5).
- Qualquer requisição com método diferente de `GET` em
  `/api/v1/manifest` retorna `405 Method Not Allowed` (header
  `Allow: GET`); qualquer requisição a um path diferente retorna
  `404 Not Found`. Ambos com corpo `ProviderError` (`code`,
  `message`, `retryable: false`).
- Sem autenticação (constitution, princípio 10) e sem CORS — o
  endpoint só é alcançável dentro da rede interna do Docker Compose
  (`eventpier-net`), nunca publica porta ao host (constitution,
  princípio 11); consumido pelo lado servidor da UI, nunca por código
  rodando no browser.
- Servidor HTTP em `node:http` puro, sem framework — dispatch manual
  por método/path. Reavaliar (Fastify) quando o número de rotas
  crescer o suficiente para justificar (spec 008, Storage, múltiplas
  rotas com parâmetros de path).

## Contrato de API

`GET /api/v1/manifest`

| Cenário | Status | Corpo |
|---|---|---|
| Requisição válida | 200 | `ProviderManifest` |
| Método ≠ `GET` no mesmo path | 405 | `ProviderError` (`code: "METHOD_NOT_ALLOWED"`) |
| Path desconhecido | 404 | `ProviderError` (`code: "NOT_FOUND"`) |

Forma exata (código, `Dockerfile`, script de validação) em
`specs/005-expor-manifesto/contracts/manifest-endpoint-shape.md`;
tipos `ProviderManifest`/`ProviderError` definidos em
`packages/contracts` (ver
[`docs/features/contracts.md`](./contracts.md)).

## Limitações conhecidas

- `environment` e `capabilities` são fixos/vazios até as specs
  006-008 existirem — não refletem o estado real de um MiniStack
  conectado ainda.
- Sem validação de schema de entrada — aceitável porque o endpoint
  não recebe nenhum input (sem query params, corpo ou parâmetros de
  path). Reavaliar quando a spec 008 (Storage) introduzir entrada real
  vinda de fora (nome de bucket, cursor de paginação).
- `Dockerfile` copia `packages/contracts/dist` manualmente para dentro
  de `node_modules/@eventpier/contracts/` no estágio runtime, sem
  `pnpm deploy` — funciona porque `packages/contracts` não tem
  nenhuma dependência própria de terceiro ainda. Reavaliar quando a
  spec 008 (Storage) trouxer uma dependência real (AWS SDK).
- Sem documentação OpenAPI/Swagger — a tabela em "Contrato de API"
  acima cobre a única rota existente sem esforço. O valor de
  OpenAPI/Swagger (exploração interativa, geração de client SDK)
  aparece com múltiplas rotas com parâmetros reais e/ou consumidores
  externos de verdade; hoje o único consumidor é a UI, server-to-server,
  na mesma rede Docker. Reavaliar junto com a decisão de Fastify
  acima, quando a spec 008 (Storage) trouxer múltiplas rotas com
  parâmetros de path.

## Specs Relacionadas

| # | Spec | Tipo | Resumo | Data |
|---|------|------|--------|------|
| 005 | [005-expor-manifesto](../../specs/005-expor-manifesto/) | ✨ Feature | Endpoint `GET /api/v1/manifest`, substitui o placeholder da spec 003 | 2026-08-19 |
