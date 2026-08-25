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
