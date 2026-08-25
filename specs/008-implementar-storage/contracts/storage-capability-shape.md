# Contrato — Forma Exata do Código da Capability Storage (008)

Forma exata que `/tasks`/`/implement` devem produzir. Referência
normativa: `docs/arquitetura.md` §2, §3, §6, refinada pelas decisões
de `research.md` e pelo modelo de `data-model.md`.

## `packages/contracts/src/storage.ts` (novo arquivo)

```ts
export interface Bucket {
  name: string;
}

export interface StorageFolderEntry {
  type: "folder";
  prefix: string;
}

export interface StorageObjectEntry {
  type: "object";
  key: string;
  size: number;
  lastModified: string;
}

export type StorageEntry = StorageFolderEntry | StorageObjectEntry;
```

## `packages/contracts/src/index.ts` (alterado — uma linha)

```ts
export * from "./manifest.js";
export * from "./pagination.js";
export * from "./errors.js";
export * from "./storage.js";
```

## `providers/aws/package.json` (alterado — nova dependência)

```json
{
  "name": "@eventpier/provider-aws",
  "version": "0.2.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "3.1117.0",
    "@eventpier/contracts": "workspace:*"
  },
  "devDependencies": {
    "vitest": "4.1.11"
  }
}
```

## `package.json` (raiz, alterado — nova devDependency)

```json
{
  "name": "eventpier-monorepo",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@11.10.0",
  "devDependencies": {
    "typescript": "7.0.2",
    "@types/node": "24.13.3",
    "@aws-sdk/client-s3": "3.1117.0"
  }
}
```

Necessário para `scripts/validate-storage-endpoint.mjs` (novo,
definido mais abaixo) resolver `@aws-sdk/client-s3` — sob o isolamento
de `node_modules` do pnpm, a dependência declarada só em
`providers/aws/package.json` não é visível a partir de `scripts/`
(`research.md`, Decisão 11). Mesma versão exata da dependência de
`providers/aws/package.json`, para evitar duas versões divergentes do
mesmo pacote no lockfile.

## `providers/aws/src/adapters/ministack/storage.adapter.ts` (novo arquivo)

```ts
import {
  ListBucketsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import type { Bucket, Page, StorageEntry } from "@eventpier/contracts";

const REGION = "us-east-1";
const CREDENTIALS = { accessKeyId: "test", secretAccessKey: "test" };
const DELIMITER = "/";
const REQUEST_TIMEOUT_MS = 3000;

export interface StorageAdapter {
  listBuckets(cursor?: string): Promise<Page<Bucket>>;
  listObjects(bucket: string, prefix?: string, cursor?: string): Promise<Page<StorageEntry>>;
}

export function createMiniStackStorageAdapter(endpoint: string): StorageAdapter {
  const client = new S3Client({
    region: REGION,
    endpoint,
    forcePathStyle: true,
    credentials: CREDENTIALS,
    requestHandler: {
      requestTimeout: REQUEST_TIMEOUT_MS,
      connectionTimeout: REQUEST_TIMEOUT_MS,
    },
  });

  return {
    async listBuckets(cursor) {
      const result = await client.send(
        new ListBucketsCommand({ ContinuationToken: cursor }),
      );
      return {
        items: (result.Buckets ?? [])
          .filter((b) => b.Name !== undefined)
          .map((b) => ({ name: b.Name! })),
        nextCursor: result.ContinuationToken,
      };
    },

    async listObjects(bucket, prefix, cursor) {
      const result = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          Delimiter: DELIMITER,
          ContinuationToken: cursor,
        }),
      );

      const folders: StorageEntry[] = (result.CommonPrefixes ?? [])
        .filter((p) => p.Prefix !== undefined)
        .map((p) => ({ type: "folder", prefix: p.Prefix! }));

      const objects: StorageEntry[] = (result.Contents ?? [])
        .filter((o) => o.Key !== undefined && o.Key !== prefix)
        .map((o) => ({
          type: "object",
          key: o.Key!,
          size: o.Size ?? 0,
          lastModified: o.LastModified?.toISOString() ?? new Date(0).toISOString(),
        }));

      return {
        items: [...folders, ...objects],
        nextCursor: result.NextContinuationToken,
      };
    },
  };
}
```

## `providers/aws/src/capabilities/storage.controller.ts` (novo arquivo)

```ts
import type {
  Bucket,
  CapabilityDescriptor,
  HealthFailureCode,
  Page,
  ProviderError,
  StorageEntry,
} from "@eventpier/contracts";
import type { HealthCache, HealthCheckFn } from "../manifest/health-cache.js";
import type { StorageAdapter } from "../adapters/ministack/storage.adapter.js";

export type StorageErrorClassification =
  | { kind: "connection"; reason: HealthFailureCode }
  | { kind: "not-found" }
  | { kind: "unknown" };

function errorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) {
    return undefined;
  }
  const withCode = err as { code?: unknown; cause?: unknown };
  if (typeof withCode.code === "string") {
    return withCode.code;
  }
  if (typeof withCode.cause === "object" && withCode.cause !== null) {
    const causeCode = (withCode.cause as { code?: unknown }).code;
    if (typeof causeCode === "string") {
      return causeCode;
    }
  }
  return undefined;
}

function errorName(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) {
    return undefined;
  }
  const name = (err as { name?: unknown }).name;
  return typeof name === "string" ? name : undefined;
}

export function classifyStorageError(err: unknown): StorageErrorClassification {
  const code = errorCode(err);
  const name = errorName(err);

  if (code === "ECONNREFUSED") {
    return { kind: "connection", reason: "CONNECTION_REFUSED" };
  }
  if (code === "ETIMEDOUT" || code === "ECONNRESET" || name === "TimeoutError") {
    return { kind: "connection", reason: "CONNECTION_TIMEOUT" };
  }
  if (name === "NoSuchBucket") {
    return { kind: "not-found" };
  }
  return { kind: "unknown" };
}

function toProviderError(classification: StorageErrorClassification): ProviderError {
  switch (classification.kind) {
    case "connection":
      return {
        code: "CONNECTION_FAILED",
        message: "Falha ao conectar ao environment configurado para a capability storage.",
        capability: "storage",
        retryable: true,
      };
    case "not-found":
      return {
        code: "RESOURCE_NOT_FOUND",
        message: "Bucket não encontrado.",
        capability: "storage",
        retryable: false,
      };
    default:
      return {
        code: "UNKNOWN",
        message: "Erro inesperado ao acessar a capability storage.",
        capability: "storage",
        retryable: false,
      };
  }
}

export function createStorageHealthCheck(adapter: StorageAdapter): HealthCheckFn {
  return async () => {
    try {
      await adapter.listBuckets();
      return { status: "available" };
    } catch (err) {
      const classification = classifyStorageError(err);
      const reason = classification.kind === "connection" ? classification.reason : "UNKNOWN";
      return { status: "unavailable", reason };
    }
  };
}

export async function getStorageCapabilityDescriptor(
  healthCache: HealthCache,
): Promise<CapabilityDescriptor> {
  const health = await healthCache.getStatus();
  if (health.status === "available") {
    return { id: "storage", status: "available" };
  }
  return { id: "storage", status: "unavailable", reason: health.reason };
}

export type StorageResult<T> =
  | { ok: true; page: Page<T> }
  | { ok: false; error: ProviderError };

async function withStorageErrorHandling<T>(
  healthCache: HealthCache,
  run: () => Promise<Page<T>>,
): Promise<StorageResult<T>> {
  try {
    return { ok: true, page: await run() };
  } catch (err) {
    const classification = classifyStorageError(err);
    if (classification.kind === "connection") {
      healthCache.invalidate();
    }
    return { ok: false, error: toProviderError(classification) };
  }
}

export function listBuckets(
  adapter: StorageAdapter,
  healthCache: HealthCache,
  cursor?: string,
): Promise<StorageResult<Bucket>> {
  return withStorageErrorHandling(healthCache, () => adapter.listBuckets(cursor));
}

export function listObjects(
  adapter: StorageAdapter,
  healthCache: HealthCache,
  bucket: string,
  prefix?: string,
  cursor?: string,
): Promise<StorageResult<StorageEntry>> {
  return withStorageErrorHandling(healthCache, () =>
    adapter.listObjects(bucket, prefix, cursor),
  );
}
```

## `providers/aws/src/capabilities/storage.controller.test.ts` (novo arquivo)

```ts
import { describe, expect, it, vi } from "vitest";
import { createHealthCache } from "../manifest/health-cache.js";
import type { StorageAdapter } from "../adapters/ministack/storage.adapter.js";
import {
  classifyStorageError,
  createStorageHealthCheck,
  getStorageCapabilityDescriptor,
  listBuckets,
  listObjects,
} from "./storage.controller.js";

function fakeAdapter(overrides: Partial<StorageAdapter> = {}): StorageAdapter {
  return {
    listBuckets: vi.fn().mockResolvedValue({ items: [] }),
    listObjects: vi.fn().mockResolvedValue({ items: [] }),
    ...overrides,
  };
}

describe("classifyStorageError", () => {
  it("classifica ECONNREFUSED como connection/CONNECTION_REFUSED", () => {
    expect(classifyStorageError({ code: "ECONNREFUSED" })).toEqual({
      kind: "connection",
      reason: "CONNECTION_REFUSED",
    });
  });

  it("classifica erro aninhado em .cause.code (ex.: fetch failed)", () => {
    expect(
      classifyStorageError({ message: "fetch failed", cause: { code: "ECONNREFUSED" } }),
    ).toEqual({ kind: "connection", reason: "CONNECTION_REFUSED" });
  });

  it.each(["ETIMEDOUT", "ECONNRESET"])(
    "classifica %s como connection/CONNECTION_TIMEOUT",
    (code) => {
      expect(classifyStorageError({ code })).toEqual({
        kind: "connection",
        reason: "CONNECTION_TIMEOUT",
      });
    },
  );

  it("classifica name TimeoutError como connection/CONNECTION_TIMEOUT", () => {
    expect(classifyStorageError({ name: "TimeoutError" })).toEqual({
      kind: "connection",
      reason: "CONNECTION_TIMEOUT",
    });
  });

  it("classifica name NoSuchBucket como not-found", () => {
    expect(classifyStorageError({ name: "NoSuchBucket" })).toEqual({ kind: "not-found" });
  });

  it("classifica erro não reconhecido como unknown", () => {
    expect(classifyStorageError(new Error("algo inesperado"))).toEqual({ kind: "unknown" });
  });

  it("classifica entradas não-objeto (ex.: string, undefined) como unknown, sem lançar", () => {
    expect(classifyStorageError("boom")).toEqual({ kind: "unknown" });
    expect(classifyStorageError(undefined)).toEqual({ kind: "unknown" });
  });
});

describe("createStorageHealthCheck", () => {
  it("retorna available quando listBuckets resolve", async () => {
    const check = createStorageHealthCheck(fakeAdapter());
    await expect(check()).resolves.toEqual({ status: "available" });
  });

  it("retorna unavailable com reason de conexão quando listBuckets rejeita com erro de conexão", async () => {
    const adapter = fakeAdapter({
      listBuckets: vi.fn().mockRejectedValue({ code: "ECONNREFUSED" }),
    });
    const check = createStorageHealthCheck(adapter);
    await expect(check()).resolves.toEqual({
      status: "unavailable",
      reason: "CONNECTION_REFUSED",
    });
  });

  it("retorna unavailable com reason UNKNOWN para erro não classificado como conexão", async () => {
    const adapter = fakeAdapter({
      listBuckets: vi.fn().mockRejectedValue(new Error("algo inesperado")),
    });
    const check = createStorageHealthCheck(adapter);
    await expect(check()).resolves.toEqual({ status: "unavailable", reason: "UNKNOWN" });
  });
});

describe("getStorageCapabilityDescriptor", () => {
  it("retorna {id: storage, status: available} sem reason quando saudável", async () => {
    const healthCache = createHealthCache(async () => ({ status: "available" }));
    await expect(getStorageCapabilityDescriptor(healthCache)).resolves.toEqual({
      id: "storage",
      status: "available",
    });
  });

  it("retorna {id: storage, status: unavailable, reason} quando indisponível", async () => {
    const healthCache = createHealthCache(async () => ({
      status: "unavailable",
      reason: "CONNECTION_TIMEOUT",
    }));
    await expect(getStorageCapabilityDescriptor(healthCache)).resolves.toEqual({
      id: "storage",
      status: "unavailable",
      reason: "CONNECTION_TIMEOUT",
    });
  });
});

describe("listBuckets", () => {
  it("retorna ok:true com a página do adapter em caso de sucesso", async () => {
    const adapter = fakeAdapter({
      listBuckets: vi.fn().mockResolvedValue({ items: [{ name: "meu-bucket" }] }),
    });
    const healthCache = createHealthCache(async () => ({ status: "available" }));

    await expect(listBuckets(adapter, healthCache)).resolves.toEqual({
      ok: true,
      page: { items: [{ name: "meu-bucket" }] },
    });
  });

  it("em falha de conexão, invalida o cache e retorna ProviderError retryable", async () => {
    const adapter = fakeAdapter({
      listBuckets: vi.fn().mockRejectedValue({ code: "ECONNREFUSED" }),
    });
    const healthCache = createHealthCache(async () => ({ status: "available" }));
    const invalidateSpy = vi.spyOn(healthCache, "invalidate");

    const result = await listBuckets(adapter, healthCache);

    expect(result).toEqual({
      ok: false,
      error: {
        code: "CONNECTION_FAILED",
        message: expect.any(String),
        capability: "storage",
        retryable: true,
      },
    });
    expect(invalidateSpy).toHaveBeenCalledOnce();
  });
});

describe("listObjects", () => {
  it("repassa bucket/prefix/cursor ao adapter e retorna a página", async () => {
    const adapter = fakeAdapter({
      listObjects: vi.fn().mockResolvedValue({
        items: [
          { type: "folder", prefix: "logs/" },
          { type: "object", key: "readme.txt", size: 10, lastModified: "2026-01-01T00:00:00.000Z" },
        ],
      }),
    });
    const healthCache = createHealthCache(async () => ({ status: "available" }));

    const result = await listObjects(adapter, healthCache, "meu-bucket", "docs/", "cursor-1");

    expect(adapter.listObjects).toHaveBeenCalledWith("meu-bucket", "docs/", "cursor-1");
    expect(result.ok).toBe(true);
  });

  it("bucket inexistente (NoSuchBucket) retorna RESOURCE_NOT_FOUND e NÃO invalida o cache", async () => {
    const adapter = fakeAdapter({
      listObjects: vi.fn().mockRejectedValue({ name: "NoSuchBucket" }),
    });
    const healthCache = createHealthCache(async () => ({ status: "available" }));
    const invalidateSpy = vi.spyOn(healthCache, "invalidate");

    const result = await listObjects(adapter, healthCache, "bucket-inexistente");

    expect(result).toEqual({
      ok: false,
      error: {
        code: "RESOURCE_NOT_FOUND",
        message: expect.any(String),
        capability: "storage",
        retryable: false,
      },
    });
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
```

## `providers/aws/src/manifest/manifest.service.ts` (alterado)

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  CONTRACT_VERSION,
  type CapabilityDescriptor,
  type Environment,
  type ProviderManifest,
} from "@eventpier/contracts";

const PACKAGE_JSON_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../package.json",
);

const { version: PROVIDER_VERSION } = JSON.parse(
  readFileSync(PACKAGE_JSON_PATH, "utf-8"),
) as { version: string };

export function buildManifest(
  environment: Environment,
  capabilities: CapabilityDescriptor[],
): ProviderManifest {
  return {
    contractVersion: CONTRACT_VERSION,
    provider: { id: "aws", name: "AWS" },
    environment,
    version: PROVIDER_VERSION,
    capabilities,
  };
}
```

Único trecho alterado: assinatura de `buildManifest()` ganha o
parâmetro `capabilities`, repassado direto ao invés do literal fixo
`[]`. Nenhuma outra linha muda.

## `providers/aws/src/index.ts` (alterado)

```ts
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { ProviderError } from "@eventpier/contracts";
import {
  InvalidEnvironmentConfigError,
  resolveEnvironmentConfig,
} from "./config/environment.config.js";
import { buildManifest } from "./manifest/manifest.service.js";
import { createHealthCache } from "./manifest/health-cache.js";
import { createMiniStackStorageAdapter } from "./adapters/ministack/storage.adapter.js";
import {
  createStorageHealthCheck,
  getStorageCapabilityDescriptor,
  listBuckets,
  listObjects,
} from "./capabilities/storage.controller.js";

const PORT = 4000;
const MANIFEST_PATH = "/api/v1/manifest";
const STORAGE_BUCKETS_PATH = "/api/v1/storage/buckets";
const STORAGE_BUCKET_OBJECTS_PATTERN = /^\/api\/v1\/storage\/buckets\/([^/]+)\/objects$/;

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    ...extraHeaders,
  });
  res.end(payload);
}

function methodNotAllowed(res: ServerResponse, method: string | undefined, path: string): void {
  const error: ProviderError = {
    code: "METHOD_NOT_ALLOWED",
    message: `Método ${method} não suportado em ${path}. Use GET.`,
    retryable: false,
  };
  sendJson(res, 405, error, { allow: "GET" });
}

function notFound(res: ServerResponse, path: string): void {
  const error: ProviderError = {
    code: "NOT_FOUND",
    message: `Recurso não encontrado: ${path}`,
    retryable: false,
  };
  sendJson(res, 404, error);
}

function storageErrorStatus(error: ProviderError): number {
  switch (error.code) {
    case "RESOURCE_NOT_FOUND":
      return 404;
    case "CONNECTION_FAILED":
      return 503;
    default:
      return 500;
  }
}

let environment;
try {
  environment = resolveEnvironmentConfig();
} catch (err) {
  if (err instanceof InvalidEnvironmentConfigError) {
    console.error(`eventpier-aws: configuração de environment inválida — ${err.message}`);
    process.exit(1);
  }
  throw err;
}

const storageAdapter = createMiniStackStorageAdapter(environment.endpoint ?? "");
const storageHealthCache = createHealthCache(createStorageHealthCheck(storageAdapter));

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;

  if (path === MANIFEST_PATH) {
    if (req.method === "GET") {
      const storageDescriptor = await getStorageCapabilityDescriptor(storageHealthCache);
      sendJson(res, 200, buildManifest(environment, [storageDescriptor]));
      return;
    }
    methodNotAllowed(res, req.method, MANIFEST_PATH);
    return;
  }

  if (path === STORAGE_BUCKETS_PATH) {
    if (req.method === "GET") {
      const cursor = url.searchParams.get("cursor") ?? undefined;
      const result = await listBuckets(storageAdapter, storageHealthCache, cursor);
      if (result.ok) {
        sendJson(res, 200, result.page);
      } else {
        sendJson(res, storageErrorStatus(result.error), result.error);
      }
      return;
    }
    methodNotAllowed(res, req.method, STORAGE_BUCKETS_PATH);
    return;
  }

  const objectsMatch = path.match(STORAGE_BUCKET_OBJECTS_PATTERN);
  if (objectsMatch) {
    if (req.method === "GET") {
      const bucket = decodeURIComponent(objectsMatch[1]);
      const prefix = url.searchParams.get("prefix") ?? undefined;
      const cursor = url.searchParams.get("cursor") ?? undefined;
      const result = await listObjects(storageAdapter, storageHealthCache, bucket, prefix, cursor);
      if (result.ok) {
        sendJson(res, 200, result.page);
      } else {
        sendJson(res, storageErrorStatus(result.error), result.error);
      }
      return;
    }
    methodNotAllowed(res, req.method, path);
    return;
  }

  notFound(res, path);
});

server.listen(PORT, () => {
  console.log(`eventpier-aws ouvindo na porta ${PORT}`);
});
```

Mudanças em relação ao arquivo atual: novos imports; `methodNotAllowed`
passa a receber `path` como parâmetro (antes fechava sobre
`MANIFEST_PATH` fixo); `path` passa a vir de `new URL(...).pathname`
em vez de `req.url.split("?")[0]` (mesmo valor para `/api/v1/manifest`
— sem regressão); `storageAdapter`/`storageHealthCache` construídos uma
única vez após a resolução de `environment`; handler do `createServer`
vira `async`; três blocos de rota (`MANIFEST_PATH`,
`STORAGE_BUCKETS_PATH`, `STORAGE_BUCKET_OBJECTS_PATTERN`) substituem o
único bloco anterior. `sendJson`/`notFound` inalterados.

## `scripts/validate-manifest-endpoint.mjs` (alterado — asserção de `capabilities`)

A asserção existente:

```js
if (!Array.isArray(manifestBody.capabilities) || manifestBody.capabilities.length !== 0) {
  errors.push(`capabilities deveria ser [], encontrado ${JSON.stringify(manifestBody.capabilities)}`);
}
```

vira:

```js
const [storageCapability, ...restCapabilities] = manifestBody.capabilities ?? [];
if (
  !Array.isArray(manifestBody.capabilities) ||
  manifestBody.capabilities.length !== 1 ||
  restCapabilities.length !== 0 ||
  storageCapability?.id !== "storage" ||
  storageCapability?.status !== "unavailable" ||
  typeof storageCapability?.reason !== "string"
) {
  errors.push(
    `capabilities deveria ter exatamente 1 item {id: "storage", status: "unavailable", reason: <string>} (MiniStack não acessível neste script), encontrado ${JSON.stringify(manifestBody.capabilities)}`,
  );
}
```

Justificativa: este script spawna `providers/aws/dist/index.js`
isoladamente, sem `docker compose` — o hostname `ministack` (default de
`environment.config.ts`) não resolve fora da rede do Compose, então a
capability `storage` é genuinamente `unavailable` aqui. Nenhuma outra
linha do script muda.

## `.pipeline/quality-gates.md` (alterado)

Linha "Testes de integração" ganha
`node scripts/validate-storage-endpoint.mjs` ao final da cadeia de
comandos existente (após `validate-environment-config.mjs`).
Parágrafo explicativo abaixo da tabela ganha uma frase descrevendo o
novo script e o novo pré-requisito: rodar
`docker compose --profile managed-env up -d ministack` antes de validar
localmente (diferente de todos os scripts anteriores, que não
dependiam de nenhum serviço externo real).

## `.github/workflows/ci.yml` (alterado)

Novo step "Iniciar MiniStack" entre "Docker build" e "Testes de
integração":

```yaml
      - name: Iniciar MiniStack
        run: docker compose --profile managed-env up -d ministack
```

Step "Testes de integração (scripts de validação estrutural)" ganha
`node scripts/validate-storage-endpoint.mjs` como última linha do
bloco `run:`.

## `scripts/validate-storage-endpoint.mjs` (novo arquivo)

```js
#!/usr/bin/env node
// Valida os endpoints de storage (GET /api/v1/storage/buckets e
// GET /api/v1/storage/buckets/:bucket/objects) do provider AWS contra
// um MiniStack real, conforme specs/008-implementar-storage/data-model.md.
//
// Diferente dos demais scripts em scripts/: depende de um MiniStack
// real e acessível (ver .pipeline/quality-gates.md — rode
// `docker compose --profile managed-env up -d ministack` antes de
// rodar este script localmente). Cria seus próprios buckets/objetos de
// teste — nunca assume dado pré-existente.
//
// Pressupõe que @eventpier/contracts e @eventpier/provider-aws já
// foram buildados. Não builda implicitamente.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CreateBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROVIDER_DIST_ENTRY = join(ROOT, "providers/aws/dist/index.js");
const PROVIDER_URL = "http://localhost:4000";
const MINISTACK_ENDPOINT = process.env.MINISTACK_ENDPOINT ?? "http://localhost:4566";
const BUCKET = `eventpier-validate-${Date.now()}`;

const errors = [];

if (!existsSync(PROVIDER_DIST_ENTRY)) {
  console.error("FALHOU — validate-storage-endpoint.mjs:");
  console.error(`  - ${PROVIDER_DIST_ENTRY} não existe. Rode o build de @eventpier/provider-aws antes de validar.`);
  process.exit(1);
}

function runProvider(env) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [PROVIDER_DIST_ENTRY], {
      stdio: ["ignore", "pipe", "inherit"],
      env: { ...process.env, ...env },
    });
    const timeout = setTimeout(
      () => reject(new Error("Timeout esperando o provider subir")),
      5000,
    );
    child.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("ouvindo na porta")) {
        clearTimeout(timeout);
        resolve(child);
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Provider encerrou antes de subir (exit code ${code})`));
    });
  });
}

// Fixture: cria um bucket com uma pasta ("prefixo") contendo um
// objeto, e um objeto solto na raiz — com retry curto, já que o
// MiniStack pode levar um instante a mais para aceitar conexões após
// `docker compose up -d`.
async function seedFixture() {
  const s3 = new S3Client({
    region: "us-east-1",
    endpoint: MINISTACK_ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
  });

  const attempts = 10;
  for (let i = 1; i <= attempts; i++) {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
      break;
    } catch (err) {
      if (i === attempts) {
        throw new Error(`Não foi possível criar o bucket de teste no MiniStack (${MINISTACK_ENDPOINT}): ${err}`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: "raiz.txt", Body: "conteudo" }));
  await s3.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: "pasta/dentro.txt", Body: "conteudo aninhado" }),
  );
}

await seedFixture();

// Cenário 1: MiniStack real acessível — caminho feliz.
{
  const child = await runProvider({ MINISTACK_ENDPOINT, MINISTACK_MANAGED: "true" });

  try {
    const bucketsRes = await fetch(`${PROVIDER_URL}/api/v1/storage/buckets`);
    const bucketsBody = await bucketsRes.json();
    if (bucketsRes.status !== 200) {
      errors.push(`GET /api/v1/storage/buckets deveria retornar 200, retornou ${bucketsRes.status}`);
    }
    if (!Array.isArray(bucketsBody.items) || !bucketsBody.items.some((b) => b.name === BUCKET)) {
      errors.push(`GET /api/v1/storage/buckets deveria incluir o bucket de teste ${BUCKET}, encontrado ${JSON.stringify(bucketsBody.items)}`);
    }

    const rootRes = await fetch(`${PROVIDER_URL}/api/v1/storage/buckets/${BUCKET}/objects`);
    const rootBody = await rootRes.json();
    const rootFolder = rootBody.items?.find((i) => i.type === "folder" && i.prefix === "pasta/");
    const rootObject = rootBody.items?.find((i) => i.type === "object" && i.key === "raiz.txt");
    if (!rootFolder) {
      errors.push(`Listagem raiz deveria conter a pasta "pasta/", encontrado ${JSON.stringify(rootBody.items)}`);
    }
    if (!rootObject || typeof rootObject.size !== "number" || typeof rootObject.lastModified !== "string") {
      errors.push(`Listagem raiz deveria conter o objeto "raiz.txt" com size/lastModified, encontrado ${JSON.stringify(rootBody.items)}`);
    }

    const nestedRes = await fetch(
      `${PROVIDER_URL}/api/v1/storage/buckets/${BUCKET}/objects?prefix=${encodeURIComponent("pasta/")}`,
    );
    const nestedBody = await nestedRes.json();
    const nestedObject = nestedBody.items?.find((i) => i.type === "object" && i.key === "pasta/dentro.txt");
    const phantomFolder = nestedBody.items?.some((i) => i.type === "object" && i.key === "pasta/");
    if (!nestedObject) {
      errors.push(`Listagem de "pasta/" deveria conter "pasta/dentro.txt", encontrado ${JSON.stringify(nestedBody.items)}`);
    }
    if (phantomFolder) {
      errors.push(`Listagem de "pasta/" não deveria conter um objeto fantasma para o próprio prefixo, encontrado ${JSON.stringify(nestedBody.items)}`);
    }

    const notFoundRes = await fetch(`${PROVIDER_URL}/api/v1/storage/buckets/bucket-que-nao-existe/objects`);
    const notFoundBody = await notFoundRes.json();
    if (notFoundRes.status !== 404 || notFoundBody.code !== "RESOURCE_NOT_FOUND") {
      errors.push(`Bucket inexistente deveria retornar 404 RESOURCE_NOT_FOUND, encontrado status=${notFoundRes.status} body=${JSON.stringify(notFoundBody)}`);
    }

    const manifestRes = await fetch(`${PROVIDER_URL}/api/v1/manifest`);
    const manifestBody = await manifestRes.json();
    const storageCapability = manifestBody.capabilities?.find((c) => c.id === "storage");
    if (storageCapability?.status !== "available") {
      errors.push(`Manifesto deveria reportar storage available com MiniStack real acessível, encontrado ${JSON.stringify(storageCapability)}`);
    }
  } finally {
    child.kill();
  }
}

// Cenário 2: endpoint inalcançável — capability indisponível, sem
// derrubar o MiniStack real usado no Cenário 1.
{
  const child = await runProvider({
    MINISTACK_ENDPOINT: "http://localhost:1",
    MINISTACK_MANAGED: "false",
  });

  try {
    const res = await fetch(`${PROVIDER_URL}/api/v1/storage/buckets`);
    const body = await res.json();
    if (res.status !== 503 || body.code !== "CONNECTION_FAILED") {
      errors.push(`Endpoint inalcançável deveria retornar 503 CONNECTION_FAILED, encontrado status=${res.status} body=${JSON.stringify(body)}`);
    }

    const manifestRes = await fetch(`${PROVIDER_URL}/api/v1/manifest`);
    const manifestBody = await manifestRes.json();
    const storageCapability = manifestBody.capabilities?.find((c) => c.id === "storage");
    if (storageCapability?.status !== "unavailable" || typeof storageCapability?.reason !== "string") {
      errors.push(`Manifesto deveria reportar storage unavailable com reason, encontrado ${JSON.stringify(storageCapability)}`);
    }
  } finally {
    child.kill();
  }
}

if (errors.length > 0) {
  console.error("FALHOU — validate-storage-endpoint.mjs:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exitCode = 1;
} else {
  console.log("OK — endpoints de storage respondem conforme data-model.md, com MiniStack real");
}
```
