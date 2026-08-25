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
