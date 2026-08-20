import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHealthCache, type HealthCheckResult } from "./health-cache.js";

const AVAILABLE: HealthCheckResult = { status: "available" };
const UNAVAILABLE: HealthCheckResult = {
  status: "unavailable",
  reason: "CONNECTION_TIMEOUT",
};

describe("createHealthCache", () => {
  const originalEnv = process.env.HEALTH_CHECK_TTL_MS;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalEnv === undefined) {
      delete process.env.HEALTH_CHECK_TTL_MS;
    } else {
      process.env.HEALTH_CHECK_TTL_MS = originalEnv;
    }
  });

  it("retorna o valor cacheado dentro do TTL (cache hit)", async () => {
    const check = vi.fn().mockResolvedValue(AVAILABLE);
    const cache = createHealthCache(check, { ttlMs: 1000 });

    await cache.getStatus();
    vi.setSystemTime(500);
    const second = await cache.getStatus();

    expect(check).toHaveBeenCalledTimes(1);
    expect(second.status).toBe("available");
  });

  it("dispara nova verificação após o TTL expirar", async () => {
    const check = vi.fn().mockResolvedValue(AVAILABLE);
    const cache = createHealthCache(check, { ttlMs: 1000 });

    await cache.getStatus();
    vi.setSystemTime(1001);
    await cache.getStatus();

    expect(check).toHaveBeenCalledTimes(2);
  });

  it("invalidate() força nova verificação antes do TTL expirar", async () => {
    const check = vi.fn().mockResolvedValue(AVAILABLE);
    const cache = createHealthCache(check, { ttlMs: 1000 });

    await cache.getStatus();
    cache.invalidate();
    vi.setSystemTime(1);
    await cache.getStatus();

    expect(check).toHaveBeenCalledTimes(2);
  });

  it("isola o cache entre duas capabilities distintas", async () => {
    const checkA = vi.fn().mockResolvedValue(AVAILABLE);
    const checkB = vi.fn().mockResolvedValue(UNAVAILABLE);
    const cacheA = createHealthCache(checkA, { ttlMs: 1000 });
    const cacheB = createHealthCache(checkB, { ttlMs: 1000 });

    await cacheA.getStatus();
    cacheA.invalidate();
    await cacheB.getStatus();

    expect(checkA).toHaveBeenCalledTimes(1);
    expect(checkB).toHaveBeenCalledTimes(1);
  });

  it("usa o default de 4000ms quando HEALTH_CHECK_TTL_MS não está definida", async () => {
    delete process.env.HEALTH_CHECK_TTL_MS;
    const check = vi.fn().mockResolvedValue(AVAILABLE);
    const cache = createHealthCache(check);

    await cache.getStatus();
    vi.setSystemTime(3999);
    await cache.getStatus();
    vi.setSystemTime(4001);
    await cache.getStatus();

    expect(check).toHaveBeenCalledTimes(2);
  });

  it("respeita HEALTH_CHECK_TTL_MS quando válida", async () => {
    process.env.HEALTH_CHECK_TTL_MS = "2000";
    const check = vi.fn().mockResolvedValue(AVAILABLE);
    const cache = createHealthCache(check);

    await cache.getStatus();
    vi.setSystemTime(2001);
    await cache.getStatus();

    expect(check).toHaveBeenCalledTimes(2);
  });

  it.each(["abc", "0", "-100"])(
    "cai no default quando HEALTH_CHECK_TTL_MS é inválida (%s)",
    async (invalid) => {
      process.env.HEALTH_CHECK_TTL_MS = invalid;
      const check = vi.fn().mockResolvedValue(AVAILABLE);
      const cache = createHealthCache(check);

      await cache.getStatus();
      vi.setSystemTime(4001);
      await cache.getStatus();

      expect(check).toHaveBeenCalledTimes(2);
    },
  );

  it("mapeia uma falha inesperada (exceção) para unavailable/UNKNOWN, sem propagar", async () => {
    const check = vi.fn().mockRejectedValue(new Error("boom"));
    const cache = createHealthCache(check, { ttlMs: 1000 });

    const result = await cache.getStatus();

    expect(result.status).toBe("unavailable");
    expect(result.reason).toBe("UNKNOWN");
  });

  it("preserva o reason classificado por uma falha esperada da capability", async () => {
    const check = vi.fn().mockResolvedValue(UNAVAILABLE);
    const cache = createHealthCache(check, { ttlMs: 1000 });

    const result = await cache.getStatus();

    expect(result.status).toBe("unavailable");
    expect(result.reason).toBe("CONNECTION_TIMEOUT");
  });

  it("uma verificação antiga em voo não sobrescreve o cache depois de invalidate() + uma verificação mais nova", async () => {
    let resolveA!: (r: HealthCheckResult) => void;
    let resolveB!: (r: HealthCheckResult) => void;
    let callCount = 0;
    const check = vi.fn(() => {
      callCount += 1;
      if (callCount === 1) {
        return new Promise<HealthCheckResult>((resolve) => {
          resolveA = resolve;
        });
      }
      return new Promise<HealthCheckResult>((resolve) => {
        resolveB = resolve;
      });
    });
    const cache = createHealthCache(check, { ttlMs: 1000 });

    const firstRead = cache.getStatus(); // dispara verificação A (fica pendente)
    cache.invalidate();
    const secondRead = cache.getStatus(); // dispara verificação B (fica pendente)

    resolveB({ status: "unavailable", reason: "CONNECTION_TIMEOUT" });
    const second = await secondRead;
    expect(second.status).toBe("unavailable");

    resolveA({ status: "available" }); // resolve depois de B, mas é a mais antiga (obsoleta)
    const first = await firstRead;
    expect(first.status).toBe("available"); // quem pediu A ainda recebe o valor real de A

    const third = await cache.getStatus();
    expect(third.status).toBe("unavailable"); // cache reflete B (mais recente), não a escrita tardia de A
    expect(check).toHaveBeenCalledTimes(2); // nenhuma terceira chamada: cache de B ainda válido
  });
});
