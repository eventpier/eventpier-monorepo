# Tasks — Capability Storage (008)

Fonte: `spec.md` (requisitos funcionais RF1-RF10), `plan.md`,
`research.md` (decisões 1-11), `data-model.md` (`Bucket`,
`StorageEntry`, `classifyStorageError`, `StorageAdapter`, funções de
`storage.controller.ts`), `contracts/storage-capability-shape.md`,
`quickstart.md`.

**Nota de abordagem de teste**: diferente das specs 005-007, esta é a
primeira spec a introduzir uma dependência de runtime nova
(`@aws-sdk/client-s3`) e a primeira em que os quality gates dependem
de um serviço externo real (`ministack`). TDD literal se aplica só à
lógica pura e testável sem rede:
`providers/aws/src/capabilities/storage.controller.test.ts` (Fase
Testes) é escrito e confirmado em **RED** antes de
`storage.adapter.ts`/`storage.controller.ts` existirem, depois
confirmado em **GREEN** na Fase Integração. O adapter real
(`storage.adapter.ts`, chamadas de verdade ao AWS SDK) **não** é
coberto por Vitest com SDK mockado (`research.md`, Decisão 7) — sua
correção é validada contra um MiniStack real via
`scripts/validate-storage-endpoint.mjs` (Fase Integração) e
`quickstart.md`, não por teste unitário.

`[P]` = paralelizável (arquivo diferente, sem dependência lógica de
outra task não concluída na mesma fase). Sem marcador = sequencial.

## Fase: Setup

- [X] **T001** Criar `packages/contracts/src/storage.ts` exatamente
  como em `contracts/storage-capability-shape.md`: `Bucket`
  (`{ name: string }`), `StorageFolderEntry`
  (`{ type: "folder"; prefix: string }`), `StorageObjectEntry`
  (`{ type: "object"; key: string; size: number; lastModified: string }`)
  e a união `StorageEntry`.
  _Origem: spec.md RF1-RF3; data-model.md ("Bucket"/"StorageEntry"); research.md Decisões 1-2._

- [X] **T002** Alterar `packages/contracts/src/index.ts`: adicionar
  `export * from "./storage.js";`. Depende de T001.
  _Origem: research.md Decisão 1; contracts/storage-capability-shape.md ("index.ts")._

- [X] **T003** Rodar `pnpm --filter @eventpier/contracts build`.
  Confirmar sem erros — `packages/contracts/dist/storage.d.ts` gerado.
  Depende de T001, T002.

- [X] **T004** `[P]` Alterar `providers/aws/package.json`: adicionar
  `"@aws-sdk/client-s3": "3.1110.0"` em `dependencies`, junto de
  `@eventpier/contracts` já existente.
  _Origem: research.md Decisão 5; contracts/storage-capability-shape.md ("providers/aws/package.json")._

- [X] **T005** `[P]` Alterar `package.json` (raiz): adicionar
  `"@aws-sdk/client-s3": "3.1110.0"` em `devDependencies`, mesma versão
  exata de T004 — necessário para `scripts/validate-storage-endpoint.mjs`
  (T015) resolver o pacote fora de qualquer workspace.
  _Origem: research.md Decisão 11; contracts/storage-capability-shape.md ("package.json (raiz)")._

- [X] **T006** Rodar `pnpm install`. Confirmar que o lockfile é
  atualizado sem erro e que `@aws-sdk/client-s3` fica resolvível tanto
  a partir de `providers/aws/` quanto da raiz do monorepo. Depende de
  T004, T005.

## Fase: Testes

- [X] **T007** Criar
  `providers/aws/src/capabilities/storage.controller.test.ts`
  exatamente como em `contracts/storage-capability-shape.md`. Deve
  validar:
  - **`classifyStorageError`**: `{code: "ECONNREFUSED"}` →
    `{kind: "connection", reason: "CONNECTION_REFUSED"}`; erro aninhado
    em `.cause.code` (padrão de "fetch failed" da SDK) classificado do
    mesmo jeito; `{code: "ETIMEDOUT"}`/`{code: "ECONNRESET"}`/
    `{name: "TimeoutError"}` (parametrizado) →
    `{kind: "connection", reason: "CONNECTION_TIMEOUT"}`;
    `{name: "NoSuchBucket"}` → `{kind: "not-found"}`; erro genérico não
    reconhecido → `{kind: "unknown"}`; entradas não-objeto (string,
    `undefined`) → `{kind: "unknown"}`, sem lançar.
  - **`createStorageHealthCheck`**: `listBuckets()` resolvendo →
    `{status: "available"}`; `listBuckets()` rejeitando com erro de
    conexão → `{status: "unavailable", reason: <reason da classificação>}`;
    rejeitando com erro não classificado como conexão →
    `{status: "unavailable", reason: "UNKNOWN"}`.
  - **`getStorageCapabilityDescriptor`**: `HealthCache` saudável →
    `{id: "storage", status: "available"}` (sem `reason`);
    `HealthCache` indisponível → `{id: "storage", status: "unavailable", reason}`.
  - **`listBuckets`**: sucesso do adapter → `{ok: true, page}` com a
    página repassada intacta; falha de conexão do adapter → `{ok: false, error}`
    com `ProviderError` `{code: "CONNECTION_FAILED", capability: "storage", retryable: true}`
    **e** `healthCache.invalidate()` chamado.
  - **`listObjects`**: repassa `bucket`/`prefix`/`cursor` ao adapter
    exatamente como recebido; bucket inexistente (`NoSuchBucket`) →
    `{ok: false, error}` com `{code: "RESOURCE_NOT_FOUND", retryable: false}`
    **e** `healthCache.invalidate()` **não** chamado (distinção do
    Requisito Funcional 7 vs. 8 de `spec.md`).
  Usar um `StorageAdapter` falso (objeto simples com `vi.fn()`), sem
  importar `@aws-sdk/client-s3`. Rodar
  `pnpm --filter @eventpier/provider-aws test` agora e confirmar que
  **falha** (RED): `./storage.adapter.js`/`./storage.controller.js`
  não existem ainda.
  _Origem: spec.md RF5-RF8; research.md Decisões 6-8; data-model.md ("classifyStorageError", funções de controller); contracts/storage-capability-shape.md ("storage.controller.test.ts")._

## Fase: Core

- [X] **T008** Criar
  `providers/aws/src/adapters/ministack/storage.adapter.ts`
  exatamente como em `contracts/storage-capability-shape.md`:
  interface `StorageAdapter` (`listBuckets`, `listObjects`);
  `createMiniStackStorageAdapter(endpoint)` construindo `S3Client` com
  `region: "us-east-1"`, `forcePathStyle: true`, credenciais fixas
  `{accessKeyId: "test", secretAccessKey: "test"}` e timeout de 3s
  (`research.md`, Decisão 5); `listObjects` usa `Delimiter: "/"`,
  mapeia `CommonPrefixes` para `{type: "folder"}` e `Contents` para
  `{type: "object"}`, descartando um item cujo `Key` seja idêntico ao
  `prefix` (`research.md`, Decisão 6). Depende de T006 (pacote
  instalado).
  _Origem: spec.md RF1-RF4; data-model.md ("StorageAdapter"); research.md Decisões 5-6; contracts/storage-capability-shape.md ("storage.adapter.ts")._

- [X] **T009** Criar
  `providers/aws/src/capabilities/storage.controller.ts` exatamente
  como em `contracts/storage-capability-shape.md`:
  `classifyStorageError`, `toProviderError`, `createStorageHealthCheck`,
  `getStorageCapabilityDescriptor`, `listBuckets`, `listObjects` (via
  `withStorageErrorHandling`, que invalida o `HealthCache` só quando
  `kind === "connection"`). Depende de T007 (TDD) e T008 (importa o
  tipo `StorageAdapter`).
  _Origem: spec.md RF5-RF8; data-model.md (todas as funções de controller); research.md Decisões 3, 7-8; contracts/storage-capability-shape.md ("storage.controller.ts")._

## Fase: Integração

Ordem sequencial — cada task assume o estado deixado pela anterior,
exceto onde marcado `[P]`.

- [X] **T010** Rodar `pnpm --filter @eventpier/provider-aws test`.
  Confirmar que agora **passa** (GREEN — T007 volta a passar contra o
  código real de T008/T009), e que os testes já existentes de
  `health-cache.test.ts`/`environment.config.test.ts` continuam
  passando sem regressão. Depende de T007, T008, T009.
  _Valida: T007._

- [X] **T011** Alterar
  `providers/aws/src/manifest/manifest.service.ts` exatamente como em
  `contracts/storage-capability-shape.md`: `buildManifest()` ganha o
  parâmetro `capabilities: CapabilityDescriptor[]`, repassado direto
  no lugar do literal fixo `[]`. Import de `CapabilityDescriptor`
  adicionado a partir de `@eventpier/contracts`.
  _Origem: spec.md RF5; research.md Decisão 3; contracts/storage-capability-shape.md ("manifest.service.ts")._

- [X] **T012** Alterar `providers/aws/src/index.ts` exatamente como em
  `contracts/storage-capability-shape.md`: importar
  `createHealthCache`, `createMiniStackStorageAdapter`,
  `createStorageHealthCheck`, `getStorageCapabilityDescriptor`,
  `listBuckets`, `listObjects`; construir `storageAdapter`/
  `storageHealthCache` uma única vez após `resolveEnvironmentConfig()`;
  trocar `req.url.split("?")[0]` por `new URL(req.url ?? "/", "http://localhost")`
  (`.pathname`/`.searchParams`); `methodNotAllowed` passa a receber
  `path` como parâmetro; handler do `createServer` vira `async`;
  adicionar as rotas `GET /api/v1/storage/buckets` e
  `GET /api/v1/storage/buckets/:bucket/objects` (regex
  `STORAGE_BUCKET_OBJECTS_PATTERN`), cada uma chamando
  `listBuckets`/`listObjects` e traduzindo `{ok:false, error}` para o
  status HTTP correto via `storageErrorStatus`
  (`RESOURCE_NOT_FOUND`→404, `CONNECTION_FAILED`→503, default→500);
  `GET /api/v1/manifest` passa a chamar
  `getStorageCapabilityDescriptor(storageHealthCache)` antes de
  `buildManifest(environment, [storageDescriptor])`. Depende de T008,
  T009, T011.
  _Origem: spec.md RF1-RF6, RF8; research.md Decisões 3-4, 7-8; contracts/storage-capability-shape.md ("index.ts")._

- [X] **T013** Rodar
  `pnpm --filter @eventpier/provider-aws build && pnpm -r exec tsc --noEmit`.
  Confirmar sem erros —
  `providers/aws/dist/adapters/ministack/storage.adapter.js` e
  `providers/aws/dist/capabilities/storage.controller.js` gerados.
  Depende de T012.
  _Valida: quickstart.md passo 2._

- [X] **T014** `[P]` Alterar `scripts/validate-manifest-endpoint.mjs`
  exatamente como em `contracts/storage-capability-shape.md`: a
  asserção de `capabilities` (antes: deveria ser `[]`) passa a exigir
  exatamente um item
  `{id: "storage", status: "unavailable", reason: <string>}` — este
  script spawna o provider isolado, sem MiniStack real acessível, então
  `storage` é genuinamente indisponível aqui.
  _Origem: research.md Decisão 10; contracts/storage-capability-shape.md ("validate-manifest-endpoint.mjs")._

- [ ] **T015** Criar `scripts/validate-storage-endpoint.mjs`
  exatamente como em `contracts/storage-capability-shape.md`: cria uma
  fixture própria (bucket + objeto na raiz + objeto sob um prefixo) via
  `@aws-sdk/client-s3` direto contra o MiniStack real (com retry curto
  aguardando o container ficar pronto); sobe o provider real apontando
  para esse MiniStack e valida `GET /api/v1/storage/buckets` (inclui o
  bucket criado), listagem raiz (distingue pasta/objeto, sem o
  marcador fantasma), listagem com `prefix` aninhado, bucket
  inexistente (`404`/`RESOURCE_NOT_FOUND`) e `GET /api/v1/manifest`
  (`storage` `available`); depois sobe **outro** processo do provider
  apontando para um endpoint inalcançável e valida `503`/
  `CONNECTION_FAILED` e `storage` `unavailable` no manifesto — sem
  derrubar o MiniStack real usado no primeiro cenário. Depende de T006
  (import do SDK a partir da raiz), T013 (precisa do `dist` gerado).
  _Origem: spec.md RF1-RF10, Critérios de Sucesso; research.md Decisões 9, 11; contracts/storage-capability-shape.md ("validate-storage-endpoint.mjs")._

- [ ] **T016** Rodar `docker compose --profile managed-env up -d ministack`.
  Confirmar que o container sobe (poucos segundos).
  _Valida: quickstart.md passo 3._

- [ ] **T017** Rodar
  `node scripts/validate-manifest-endpoint.mjs && node scripts/validate-environment-config.mjs && node scripts/validate-storage-endpoint.mjs`.
  Confirmar `OK` nos três. Depende de T014, T015, T016.
  _Valida: quickstart.md passos 5-7; spec.md Critérios de Sucesso (todos)._

- [ ] **T018** Rodar
  `docker compose --profile managed-env up --build` e, em seguida,
  `docker compose logs eventpier-aws`. Confirmar a mensagem
  "eventpier-aws ouvindo na porta 4000" sem nenhum erro nos logs.
  Encerrar com `docker compose --profile managed-env down`.
  _Valida: quickstart.md passo 8._

- [ ] **T019** `[P]` Atualizar `.pipeline/quality-gates.md`: inserir
  `node scripts/validate-storage-endpoint.mjs` ao final da cadeia de
  comandos da linha **Testes de integração** (após
  `validate-environment-config.mjs`); adicionar um parágrafo
  explicando o novo script e o novo pré-requisito
  (`docker compose --profile managed-env up -d ministack` antes de
  rodar localmente).
  _Origem: research.md Decisão 9 ("Consequência para /tasks"); contracts/storage-capability-shape.md ("quality-gates.md")._

- [ ] **T020** `[P]` Atualizar `.github/workflows/ci.yml`: inserir um
  novo step "Iniciar MiniStack"
  (`docker compose --profile managed-env up -d ministack`) entre
  "Docker build" e "Testes de integração"; inserir
  `node scripts/validate-storage-endpoint.mjs` como última linha do
  bloco `run:` do step de testes de integração.
  _Origem: research.md Decisão 9 ("Consequência para /tasks"); contracts/storage-capability-shape.md ("ci.yml")._

- [ ] **T021** Rodar `git status --short`. Confirmar que as mudanças
  ficam restritas a `packages/contracts/src/storage.ts` (novo),
  `packages/contracts/src/index.ts`, `package.json` (raiz),
  `providers/aws/package.json`, `pnpm-lock.yaml`,
  `providers/aws/src/adapters/ministack/storage.adapter.ts` (novo),
  `providers/aws/src/capabilities/storage.controller.ts` (novo),
  `providers/aws/src/capabilities/storage.controller.test.ts` (novo),
  `providers/aws/src/manifest/manifest.service.ts`,
  `providers/aws/src/index.ts`, `scripts/validate-manifest-endpoint.mjs`,
  `scripts/validate-storage-endpoint.mjs` (novo),
  `.pipeline/quality-gates.md`, `.github/workflows/ci.yml` — nenhuma
  mudança em `providers/aws/src/manifest/health-cache.ts`,
  `providers/aws/src/config/environment.config.ts`,
  `docker-compose.yml`, `.env.example` ou `apps/ui/`.
  _Valida: quickstart.md passo 9._

## Fase: Polish

- [ ] **T022** `[P]` Preencher `research.md` → "Decisões durante a
  implementação" com qualquer decisão não prevista (ex.: ajuste de
  timeout do `S3Client`, comportamento real de `ListBucketsCommand`
  com `ContinuationToken` no MiniStack, ou qualquer divergência entre
  o comportamento assumido via pesquisa externa e o comportamento real
  observado no MiniStack durante T015-T018).

- [ ] **T023** `[P]` Rodar `find packages/contracts/src -type f` e
  `find providers/aws/src -type f`. Confirmar que a primeira lista
  inclui exatamente `storage.ts` como novo arquivo (além dos já
  existentes) e a segunda inclui exatamente
  `adapters/ministack/storage.adapter.ts`,
  `capabilities/storage.controller.ts` e
  `capabilities/storage.controller.test.ts` como novos — nenhum
  arquivo de capability futura (`queue`/`topic`/etc., fora do MVP)
  vazado.
  _Origem: spec.md "Fora do escopo"._

- [ ] **T024** Revisão final contra `spec.md` → "Critérios de
  Sucesso" e "Requisitos Funcionais", lendo o código produzido (não só
  rodando gates): confirmar que nenhuma operação de escrita sobre
  bucket/objeto existe em nenhum arquivo tocado (RF9 — só
  `ListBucketsCommand`/`ListObjectsV2Command`, nunca `PutObject`/
  `CreateBucket`/`DeleteObject` fora do script de fixture de teste);
  que `healthCache.invalidate()` só é chamado em falha de conexão real,
  nunca em `NoSuchBucket` (RF7 vs. RF8); que nenhuma autenticação foi
  introduzida em nenhuma rota nova (RF10); que as mensagens de
  `ProviderError` são claras e sempre incluem `capability: "storage"`.
