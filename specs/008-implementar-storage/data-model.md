# Data Model — Capability Storage (008)

## Entidade: `Bucket` (contrato novo, `packages/contracts/src/storage.ts`)

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `name` | `string` | sim | Identificador do bucket, exatamente como retornado pelo MiniStack |

## Entidade: `StorageEntry` (contrato novo, união discriminada)

```ts
type StorageEntry =
  | { type: "folder"; prefix: string }
  | { type: "object"; key: string; size: number; lastModified: string };
```

| Variante | Campo | Tipo | Descrição |
|---|---|---|---|
| `folder` | `prefix` | `string` | Prefixo comum completo (inclui o delimiter `/` final) — usado como o próximo `prefix` numa chamada subsequente para "entrar" na pasta |
| `object` | `key` | `string` | Chave completa do objeto (não relativa) |
| `object` | `size` | `number` | Tamanho em bytes |
| `object` | `lastModified` | `string` | Data da última modificação, ISO 8601 |

Um item cujo `Key` (SDK) seja idêntico ao `prefix` da chamada é
descartado antes de virar uma entrada `object` (Decisão 6 de
`research.md`) — evita expor o "objeto marcador de pasta" de zero
bytes como se fosse conteúdo real.

## Reuso de contrato existente (sem alteração de forma)

| Tipo | Origem | Uso nesta spec |
|---|---|---|
| `Page<T>` | `packages/contracts/src/pagination.ts` | `Page<Bucket>` (listagem de buckets) e `Page<StorageEntry>` (listagem de objetos/pastas) |
| `ProviderError` | `packages/contracts/src/errors.ts` | Corpo de erro de todas as rotas novas; `capability: "storage"` sempre preenchido |
| `CapabilityDescriptor` | `packages/contracts/src/manifest.ts` | `{ id: "storage", status, reason? }`, computado a cada requisição de manifesto |
| `CachedHealth`/`HealthCache`/`HealthCheckFn` | `providers/aws/src/manifest/health-cache.ts` (spec 006) | Uma instância própria (`createHealthCache(...)`) dedicada à capability `storage`, isolada de qualquer outra capability futura |
| `Environment` | `packages/contracts/src/manifest.ts` | `environment.endpoint` (spec 007) é o único dado usado para construir o `S3Client` |

## Função: `classifyStorageError(err: unknown): StorageErrorClassification`

```ts
type StorageErrorClassification =
  | { kind: "connection"; reason: HealthFailureCode }
  | { kind: "not-found" }
  | { kind: "unknown" };
```

### Regras de classificação

| Entrada | Resultado |
|---|---|
| `err.code` (ou `err.cause?.code`) === `"ECONNREFUSED"` | `{ kind: "connection", reason: "CONNECTION_REFUSED" }` |
| `err.code`/`err.cause?.code` em `{"ETIMEDOUT", "ECONNRESET"}`, ou `err.name === "TimeoutError"` | `{ kind: "connection", reason: "CONNECTION_TIMEOUT" }` |
| `err.name === "NoSuchBucket"` | `{ kind: "not-found" }` |
| Qualquer outro erro | `{ kind: "unknown" }` |

Nunca lança — sempre retorna uma classificação, mesmo para entradas
inesperadas (`kind: "unknown"` como fallback seguro).

## Função: `StorageAdapter` (interface, `providers/aws/src/adapters/ministack/storage.adapter.ts`)

```ts
interface StorageAdapter {
  listBuckets(cursor?: string): Promise<Page<Bucket>>;
  listObjects(bucket: string, prefix?: string, cursor?: string): Promise<Page<StorageEntry>>;
}
```

Implementação real: `createMiniStackStorageAdapter(endpoint: string): StorageAdapter`,
usando `@aws-sdk/client-s3` (`S3Client`, `ListBucketsCommand`,
`ListObjectsV2Command` com `Delimiter: "/"`). Erros do SDK propagam
sem tratamento no adapter — a classificação (Decisão 7) e a decisão de
invalidar o cache acontecem em `capabilities/storage.controller.ts`,
não no adapter.

## Funções: `capabilities/storage.controller.ts`

```ts
function createStorageHealthCheck(adapter: StorageAdapter): HealthCheckFn;

function getStorageCapabilityDescriptor(
  healthCache: HealthCache,
): Promise<CapabilityDescriptor>;

type StorageResult<T> =
  | { ok: true; page: Page<T> }
  | { ok: false; error: ProviderError };

function listBuckets(
  adapter: StorageAdapter,
  healthCache: HealthCache,
  cursor?: string,
): Promise<StorageResult<Bucket>>;

function listObjects(
  adapter: StorageAdapter,
  healthCache: HealthCache,
  bucket: string,
  prefix?: string,
  cursor?: string,
): Promise<StorageResult<StorageEntry>>;
```

`listBuckets`/`listObjects` chamam o adapter; em caso de erro,
classificam via `classifyStorageError`; se `kind === "connection"`,
chamam `healthCache.invalidate()` antes de retornar `{ ok: false, error }`
— nunca em `kind === "not-found"` ou `"unknown"`.

### Mapeamento classificação → `ProviderError`

| `kind` | `code` | `retryable` | Status HTTP (em `index.ts`) |
|---|---|---|---|
| `connection` | `"CONNECTION_FAILED"` | `true` | 503 |
| `not-found` | `"RESOURCE_NOT_FOUND"` | `false` | 404 |
| `unknown` | `"UNKNOWN"` | `false` | 500 |

## Relacionamentos

```text
index.ts (bootstrap, executa uma única vez)
├── resolveEnvironmentConfig() → environment (spec 007)
├── createMiniStackStorageAdapter(environment.endpoint) → storageAdapter
└── createHealthCache(createStorageHealthCheck(storageAdapter)) → storageHealthCache

index.ts (por requisição)
├── GET /api/v1/manifest
│   └── getStorageCapabilityDescriptor(storageHealthCache) → CapabilityDescriptor
│       └── buildManifest(environment, [descriptor])
├── GET /api/v1/storage/buckets?cursor=
│   └── listBuckets(storageAdapter, storageHealthCache, cursor)
└── GET /api/v1/storage/buckets/:bucket/objects?prefix=&cursor=
    └── listObjects(storageAdapter, storageHealthCache, bucket, prefix, cursor)
```

## Fora do escopo desta entidade/modelo

- Qualquer campo de bucket/objeto além dos listados (Decisão 2 de
  `research.md`).
- Qualquer capability além de `storage` — `getStorageCapabilityDescriptor`
  não é genérico, é específico desta capability (generalizar para
  outras capabilities é decisão da spec que introduzir a segunda
  capability real).
- Configuração de credenciais/região do `S3Client` — fixas no código
  (Decisão 5 de `research.md`).
