# Contrato — Forma do Módulo de Cache de Health-check e Arquivos Relacionados (006)

Forma exata que `/tasks`/`/implement` devem produzir. Referência
normativa: `docs/arquitetura.md` §4 (Health-check e Cache), refinada
pelas decisões de `research.md` e pelo modelo de `data-model.md`.

## `providers/aws/src/manifest/health-cache.ts` (novo arquivo)

```ts
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
```

## `providers/aws/src/manifest/health-cache.test.ts` (novo arquivo)

```ts
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
});
```

## `providers/aws/package.json` (campos novos)

```json
{
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "4.1.11"
  }
}
```

Mesclado ao `package.json` já existente (`dependencies.@eventpier/contracts`
e demais campos inalterados) — ver arquivo atual em
`providers/aws/package.json`.

## `providers/aws/tsconfig.json`

Sem mudanças — ver Decisão 8 de `research.md` (sem `exclude` de
arquivos `*.test.ts`; `src/manifest/health-cache.test.ts` entra no
escopo normal de `include: ["src"]`).

## `.pipeline/quality-gates.md` (nova linha na tabela de gates)

Inserida **antes** da linha "Build" (sem dependência de nenhum outro
gate, feedback mais rápido):

```markdown
| Testes unitários | `pnpm --filter @eventpier/provider-aws test` | Vitest reporta todos os testes passando (exit code 0) |
```

A linha "Testes" existente é renomeada para **"Testes de integração"**
para desambiguar da linha nova — nenhum script dessa linha muda, só o
rótulo.

## `.github/workflows/ci.yml` (novo step)

Inserido logo após "Install dependencies", antes de "Build":

```yaml
      - name: Testes unitários
        run: pnpm --filter @eventpier/provider-aws test
```

O step "Testes (scripts de validação estrutural)" existente é renomeado
para "Testes de integração (scripts de validação estrutural)",
mantendo o mesmo conteúdo — mesma renomeação de rótulo do
`quality-gates.md`.
