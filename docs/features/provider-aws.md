# Provider AWS — `providers/aws`

## O que o módulo faz

`providers/aws` (`@eventpier/provider-aws`) é o provider AWS do
Eventpier: expõe capabilities do MiniStack via um manifesto HTTP
consumido pela UI. Hoje expõe o manifesto do provider e a primeira
capability real, **Storage** (listar buckets, navegar objetos por
prefixo) — somente leitura.

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
- **Capability Storage** (`src/adapters/ministack/storage.adapter.ts` +
  `src/capabilities/storage.controller.ts`, spec 008): primeira
  capability real do provider, somente leitura. `createMiniStackStorageAdapter(endpoint)`
  usa `@aws-sdk/client-s3` (`forcePathStyle: true`, credenciais dummy
  fixas `test`/`test`, região `us-east-1`, timeout de 3s) apontando o
  `endpoint` já resolvido por `environment.config.ts` — nenhuma API
  proprietária do MiniStack, o mesmo SDK que qualquer aplicação real
  usaria. `listObjects` usa `Delimiter: "/"`, retornando uma lista
  única (`StorageEntry[]`) que mistura pastas (`{type: "folder", prefix}`,
  de `CommonPrefixes`) e objetos (`{type: "object", key, size,
  lastModified}`, de `Contents`) do nível navegado — nunca uma lista
  plana de chaves. Um item cujo `Key` seja idêntico ao `prefix`
  informado é descartado (evita expor o "objeto marcador de pasta" de
  zero bytes que alguns clientes S3 criam).
- **Classificação de erros da capability** (`storage.controller.ts`,
  `classifyStorageError`): distingue três casos a partir do erro
  lançado pelo AWS SDK — `connection` (`ECONNREFUSED`/`ENOTFOUND`/
  `EAI_AGAIN`/`ETIMEDOUT`/`ECONNRESET`/`TimeoutError`, inclusive
  aninhado em `.cause.code` — cobre tanto conexão recusada quanto
  falha de resolução DNS do hostname configurado), `not-found`
  (`NoSuchBucket`) e `unknown` (qualquer outro). Só falha de
  `connection` invalida ativamente o cache de health-check da
  capability — um bucket inexistente retorna `ProviderError`
  (`RESOURCE_NOT_FOUND`, 404) sem afetar o status reportado no
  manifesto, já que o environment respondeu normalmente. Erros
  `unknown` (não classificados) são logados server-side
  (`console.error`) — os ramos já classificados não precisam, porque
  `code`/status HTTP já carregam informação suficiente para quem
  chama.
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
  ordem (achado e corrigido no `/review-pr` da PR da spec 006 — ver
  `specs/006-cachear-health-check/research.md`, "Decisões durante a
  implementação"). **Integrado ao manifesto desde a spec 008**:
  `capabilities` passa a conter `{id: "storage", status, reason?}`,
  computado a cada requisição via `getStorageCapabilityDescriptor()`
  (chama `adapter.listBuckets()` como verificação real, a operação
  mais barata sem efeitos colaterais disponível).
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
  por método/path, path com parâmetro casado via regex
  (`/api/v1/storage/buckets/:bucket/objects`), query string
  (`prefix`/`cursor`) via `URL`/`URLSearchParams` nativos. Reavaliado
  na spec 008 (3 rotas, uma com parâmetro) e mantido sem framework —
  ainda administrável manualmente; reavaliar de novo se uma futura
  capability (`queue`/`topic`/etc., fora do MVP) trouxer mais rotas.
- **Handler HTTP protegido por try/catch** (achado externo, bot Codex,
  PR #15): o handler do `createServer` é `async`; qualquer exceção
  síncrona não capturada dentro dele (ex.: `decodeURIComponent` de um
  segmento de bucket malformado) vira uma promise rejeitada não
  tratada, e o Node encerra o processo por padrão nesse caso — uma
  única requisição malformada derrubava o provider inteiro antes desta
  correção. Um segmento de bucket com percent-encoding inválido (ex.:
  `/api/v1/storage/buckets/%/objects`) agora retorna `400 BAD_REQUEST`;
  qualquer outra exceção síncrona inesperada em qualquer rota é pega
  pelo try/catch geral do handler e vira `500` (logado server-side),
  nunca derruba o processo.

## Contrato de API

`GET /api/v1/manifest`

| Cenário | Status | Corpo |
|---|---|---|
| Requisição válida | 200 | `ProviderManifest` (`capabilities` inclui `storage`) |
| Método ≠ `GET` no mesmo path | 405 | `ProviderError` (`code: "METHOD_NOT_ALLOWED"`) |
| Path desconhecido | 404 | `ProviderError` (`code: "NOT_FOUND"`) |

`GET /api/v1/storage/buckets` (query opcional: `cursor`)

| Cenário | Status | Corpo |
|---|---|---|
| Requisição válida | 200 | `Page<Bucket>` |
| Falha de conexão com o environment | 503 | `ProviderError` (`code: "CONNECTION_FAILED"`, `retryable: true`) |
| Método ≠ `GET` no mesmo path | 405 | `ProviderError` (`code: "METHOD_NOT_ALLOWED"`) |

`GET /api/v1/storage/buckets/:bucket/objects` (query opcional: `prefix`, `cursor`)

| Cenário | Status | Corpo |
|---|---|---|
| Requisição válida | 200 | `Page<StorageEntry>` (mistura `{type: "folder"}`/`{type: "object"}`) |
| Bucket inexistente | 404 | `ProviderError` (`code: "RESOURCE_NOT_FOUND"`, `retryable: false`) |
| Falha de conexão com o environment | 503 | `ProviderError` (`code: "CONNECTION_FAILED"`, `retryable: true`) |
| Segmento de bucket com percent-encoding inválido | 400 | `ProviderError` (`code: "BAD_REQUEST"`, `retryable: false`) |
| Método ≠ `GET` no mesmo path | 405 | `ProviderError` (`code: "METHOD_NOT_ALLOWED"`) |

Forma exata (código, `Dockerfile`, script de validação) em
`specs/005-expor-manifesto/contracts/manifest-endpoint-shape.md` e
`specs/008-implementar-storage/contracts/storage-capability-shape.md`;
tipos `ProviderManifest`/`ProviderError`/`Page`/`Bucket`/`StorageEntry`
definidos em `packages/contracts` (ver
[`docs/features/contracts.md`](./contracts.md)).

## Limitações conhecidas

- `health-cache.ts` não deduplica chamadas concorrentes: duas
  `getStatus()` simultâneas com cache expirado disparam duas
  verificações reais independentes (decisão consciente, ver
  `specs/006-cachear-health-check/research.md`, Decisão 4 — nenhum
  consumidor real ainda para justificar a complexidade de compartilhar
  uma promise em voo). Isso é só uma questão de eficiência, não de
  corretude: um contador de geração interno garante que a verificação
  que resolver por último nunca sobrescreve um resultado mais recente
  nem desfaz um `invalidate()` — corrigido e coberto por teste de
  regressão no `/review-pr` da PR da spec 006.
- Sem documentação OpenAPI/Swagger — a tabela em "Contrato de API"
  acima cobre as três rotas existentes sem esforço. O valor de
  OpenAPI/Swagger (exploração interativa, geração de client SDK)
  aparece com mais rotas e/ou consumidores externos de verdade; hoje o
  único consumidor é a UI, server-to-server, na mesma rede Docker.

## Specs Relacionadas

| # | Spec | Tipo | Resumo | Data |
|---|------|------|--------|------|
| 008 | [008-implementar-storage](../../specs/008-implementar-storage/) | ✨ Feature | Primeira capability real (Storage): listar buckets, navegar objetos por prefixo distinguindo pastas de objetos; `capabilities` do manifesto deixa de ser vazio | 2026-08-25 |
| 007 | [007-configurar-environment](../../specs/007-configurar-environment/) | ✨ Feature | `environment` do manifesto passa a ser configurável (`MINISTACK_ENDPOINT`/`MINISTACK_MANAGED`), com fail-fast em configuração inválida | 2026-08-24 |
| 006 | [006-cachear-health-check](../../specs/006-cachear-health-check/) | ✨ Feature | Cache genérico de health-check por capability, isolado (`health-cache.ts`) — ainda não integrado ao manifesto | 2026-08-20 |
| 005 | [005-expor-manifesto](../../specs/005-expor-manifesto/) | ✨ Feature | Endpoint `GET /api/v1/manifest`, substitui o placeholder da spec 003 | 2026-08-19 |
