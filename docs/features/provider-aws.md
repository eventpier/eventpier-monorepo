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
- **`environment` é configurável via variáveis de ambiente**
  (`src/config/environment.config.ts`, spec 007):
  `resolveEnvironmentConfig()` lê `MINISTACK_ENDPOINT`/
  `MINISTACK_MANAGED` uma única vez no bootstrap do processo (não por
  requisição) e monta o `Environment` do manifesto a partir delas.
  Sem nenhuma variável definida, o default é preservado (`{ id:
  "ministack", endpoint: "http://ministack:4566", managed: true }`) —
  `endpoint` é **sempre** exposto no manifesto, mesmo quando é o
  default gerenciado pelo Compose (decisão deliberada: o Eventpier é
  uma ferramenta de inspeção, esconder o endpoint real por ser "só o
  default" tiraria do consumidor do manifesto a informação mais útil
  para debug). `managed: false` + `MINISTACK_ENDPOINT` customizado
  aponta o provider para uma instância externa já em execução.
  **Fail-fast**: `managed: false` sem endpoint, ou um valor não
  reconhecível para `MINISTACK_MANAGED` (só `"true"`/`"false"`,
  case-insensitive, são aceitos), impede o processo de subir —
  mensagem de erro em `stderr`, `process.exit(1)`, sem nunca chamar
  `server.listen`. Contraste deliberado com `HEALTH_CHECK_TTL_MS`
  (linha acima, que cai silenciosamente no default): aqui um valor
  malformado poderia levar uma capability futura a operar contra o
  ambiente errado sem aviso, o que justifica um tratamento mais
  rígido (ver `specs/007-configurar-environment/research.md`,
  Decisão 4). `GET /api/v1/manifest` continua respondendo 200
  independente de o endpoint configurado estar de fato acessível —
  `EnvironmentConfig` só declara "para onde apontar", nenhuma
  verificação de conectividade é feita.
- `capabilities` é sempre `[]` nesta versão — nenhuma capability real
  está implementada ainda (Storage é spec 008). Uma lista vazia
  comunica "provider não implementa capability nenhuma ainda",
  distinto de "capability implementada mas indisponível agora"
  (constitution, princípio 5).
- **Cache de health-check por capability** (`src/manifest/health-cache.ts`,
  spec 006): mecanismo genérico e isolado por instância —
  `createHealthCache(check, options?)` retorna `{ getStatus, invalidate }`.
  Cacheia em memória o resultado de uma verificação real (`HealthCheckFn`
  fornecida por quem cria a instância), com TTL default de 4000ms
  (dentro do intervalo 3-5s do princípio 6 da constitution),
  configurável via `HEALTH_CHECK_TTL_MS` (valor ausente/inválido cai
  silenciosamente no default). `invalidate()` limpa o cache e invalida
  qualquer verificação já em voo (contador de geração interno — ver
  "Comportamentos-chave" abaixo), forçando nova verificação real na
  leitura seguinte, independente do TTL restante. Qualquer falha
  (esperada ou não) vira `{status: "unavailable", reason:
  HealthFailureCode}` — nunca uma exceção propagada. Seguro sob
  concorrência: verificações concorrentes nunca se sobrescrevem fora de
  ordem (achado e corrigido no `/review-pr` da PR desta spec — ver
  `specs/006-cachear-health-check/research.md`, "Decisões durante a
  implementação"). Ainda **não integrado** ao manifesto — nenhuma
  capability real o utiliza nesta versão; `capabilities` continua `[]`
  (ver linha acima). Fica pronto para a spec 008 (Storage) importar
  sem exigir mudança de assinatura.
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

- `capabilities` continua vazio até a spec 008 existir — não reflete
  o estado real de um MiniStack conectado ainda. `environment` já é
  configurável (spec 007), mas nenhuma verificação de conectividade é
  feita sobre o `endpoint` declarado — só o health-check (specs
  006/008) faz isso, e ainda não está integrado a nenhuma capability
  real.
- `health-cache.ts` não deduplica chamadas concorrentes: duas
  `getStatus()` simultâneas com cache expirado disparam duas
  verificações reais independentes (decisão consciente, ver
  `specs/006-cachear-health-check/research.md`, Decisão 4 — nenhum
  consumidor real ainda para justificar a complexidade de compartilhar
  uma promise em voo). Isso é só uma questão de eficiência, não de
  corretude: um contador de geração interno garante que a verificação
  que resolver por último nunca sobrescreve um resultado mais recente
  nem desfaz um `invalidate()` — corrigido e coberto por teste de
  regressão no `/review-pr` da PR desta spec.
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
| 007 | [007-configurar-environment](../../specs/007-configurar-environment/) | ✨ Feature | `environment` do manifesto passa a ser configurável (`MINISTACK_ENDPOINT`/`MINISTACK_MANAGED`), com fail-fast em configuração inválida | 2026-08-24 |
| 006 | [006-cachear-health-check](../../specs/006-cachear-health-check/) | ✨ Feature | Cache genérico de health-check por capability, isolado (`health-cache.ts`) — ainda não integrado ao manifesto | 2026-08-20 |
| 005 | [005-expor-manifesto](../../specs/005-expor-manifesto/) | ✨ Feature | Endpoint `GET /api/v1/manifest`, substitui o placeholder da spec 003 | 2026-08-19 |
