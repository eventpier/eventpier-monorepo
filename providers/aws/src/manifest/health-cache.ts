import type { HealthFailureCode } from "@eventpier/contracts";

export interface CachedHealth {
  status: "available" | "unavailable";
  reason?: HealthFailureCode;
  checkedAt: number;
}

export type HealthCheckResult =
  | { status: "available" }
  | { status: "unavailable"; reason: HealthFailureCode };

export type HealthCheckFn = () => Promise<HealthCheckResult>;

export interface HealthCache {
  getStatus(): Promise<CachedHealth>;
  invalidate(): void;
}

const DEFAULT_TTL_MS = 4000;

function resolveTtlMs(explicit?: number): number {
  if (explicit !== undefined) {
    return explicit;
  }
  const fromEnv = process.env.HEALTH_CHECK_TTL_MS;
  if (fromEnv === undefined) {
    return DEFAULT_TTL_MS;
  }
  const parsed = Number(fromEnv);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_MS;
}

export function createHealthCache(
  check: HealthCheckFn,
  options: { ttlMs?: number } = {},
): HealthCache {
  const ttlMs = resolveTtlMs(options.ttlMs);
  let cached: CachedHealth | null = null;
  let generation = 0;

  async function runCheck(): Promise<CachedHealth> {
    const myGeneration = ++generation;
    let result: HealthCheckResult;
    try {
      result = await check();
    } catch {
      result = { status: "unavailable", reason: "UNKNOWN" };
    }
    const fresh: CachedHealth = { ...result, checkedAt: Date.now() };
    // Só grava no cache se nenhuma verificação mais nova (ou invalidate())
    // começou desde que esta foi disparada — evita que uma verificação
    // lenta e obsoleta sobrescreva um resultado mais recente ao resolver
    // por último.
    if (myGeneration === generation) {
      cached = fresh;
    }
    return fresh;
  }

  return {
    async getStatus(): Promise<CachedHealth> {
      if (cached !== null && Date.now() - cached.checkedAt < ttlMs) {
        return cached;
      }
      return runCheck();
    },
    invalidate(): void {
      cached = null;
      generation++;
    },
  };
}
