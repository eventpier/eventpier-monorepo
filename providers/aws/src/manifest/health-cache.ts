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

  async function runCheck(): Promise<CachedHealth> {
    let result: HealthCheckResult;
    try {
      result = await check();
    } catch {
      result = { status: "unavailable", reason: "UNKNOWN" };
    }
    cached = { ...result, checkedAt: Date.now() };
    return cached;
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
    },
  };
}
