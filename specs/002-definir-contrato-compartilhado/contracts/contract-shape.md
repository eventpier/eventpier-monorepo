# Contrato — Forma de `packages/contracts` (002)

Forma exata que `/tasks`/`/implement` devem produzir. Referência
normativa: `docs/arquitetura.md` §3, refinada pelas decisões de
`research.md` (arrays `as const`, extensão `.js` em imports internos).

## `packages/contracts/src/manifest.ts`

```ts
export const CONTRACT_VERSION = "1.0.0";

export const CAPABILITIES = [
  "storage",
  "queue",
  "topic",
  "secret",
  "logs",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_STATUSES = [
  "available",
  "unavailable",
  "degraded",
] as const;
export type CapabilityStatus = (typeof CAPABILITY_STATUSES)[number];

export const HEALTH_FAILURE_CODES = [
  "CONNECTION_TIMEOUT",
  "CONNECTION_REFUSED",
  "AUTH_FAILED",
  "UNKNOWN",
] as const;
export type HealthFailureCode = (typeof HEALTH_FAILURE_CODES)[number];

export interface Provider {
  id: string;
  name: string;
}

export interface Environment {
  id: string;
  endpoint?: string;
  managed: boolean;
}

export interface CapabilityDescriptor {
  id: Capability;
  status: CapabilityStatus;
  reason?: HealthFailureCode;
}

export interface ProviderManifest {
  contractVersion: string;
  provider: Provider;
  environment: Environment;
  version: string;
  capabilities: CapabilityDescriptor[];
}
```

## `packages/contracts/src/pagination.ts`

```ts
export interface Page<T> {
  items: T[];
  nextCursor?: string;
}
```

## `packages/contracts/src/errors.ts`

```ts
import type { Capability } from "./manifest.js";

export interface ProviderError {
  code: string;
  message: string;
  capability?: Capability;
  retryable: boolean;
}
```

## `packages/contracts/src/index.ts` (barrel público)

```ts
export * from "./manifest.js";
export * from "./pagination.js";
export * from "./errors.js";
```

## `packages/contracts/src/contract-shape.check.ts` (não exportado pelo barrel)

Arquivo de verificação em tempo de compilação — não é parte da API
pública, existe só para o gate Typecheck (`pnpm -r exec tsc --noEmit`)
pegar regressão de forma. Constrói um exemplo válido de cada tipo
público; comentários marcam o que seria inválido, para reforçar as
invariantes de `data-model.md` no ponto de leitura mais provável.

```ts
import type {
  CapabilityDescriptor,
  Page,
  ProviderError,
  ProviderManifest,
} from "./index.js";
import { CONTRACT_VERSION } from "./manifest.js";

const availableCapability: CapabilityDescriptor = {
  id: "storage",
  status: "available",
  // reason omitido de propósito — "available" não deve ter reason (data-model.md)
};

const unavailableCapability: CapabilityDescriptor = {
  id: "queue",
  status: "unavailable",
  reason: "CONNECTION_REFUSED", // obrigatório por convenção quando "unavailable"
};

const exampleManifest: ProviderManifest = {
  contractVersion: CONTRACT_VERSION,
  provider: { id: "aws", name: "AWS" },
  environment: { id: "ministack", managed: true },
  version: "0.1.0",
  capabilities: [availableCapability, unavailableCapability],
};

const examplePage: Page<{ id: string }> = {
  items: [{ id: "example" }],
  // nextCursor omitido de propósito — ausência = fim da paginação (data-model.md)
};

const exampleError: ProviderError = {
  code: "RESOURCE_NOT_FOUND",
  message: "Bucket não encontrado",
  capability: "storage",
  retryable: false,
};

// Silencia "declared but never read" sem exportar estes exemplos como API pública.
void exampleManifest;
void examplePage;
void exampleError;
```

## `packages/contracts/package.json`

```json
{
  "name": "@eventpier/contracts",
  "version": "0.2.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json"
  }
}
```

`tsconfig.json` do workspace não muda — já tinha `outDir: "dist"` e
`include: ["src"]` desde a spec 001, o que já inclui
`contract-shape.check.ts` na compilação.

## `scripts/validate-contract-constants.mjs` (novo, raiz do monorepo)

Mesmo padrão dos scripts existentes (`validate-workspace-manifests.mjs`,
`validate-workspace-dependencies.mjs`): sem dependência externa, só
`node:fs`/`node:path`/`node:assert` do core, exit code 0/1.

Responsabilidades:
1. Verificar que `packages/contracts/dist/index.js` existe; se não,
   falhar com mensagem instruindo a rodar
   `pnpm --filter @eventpier/contracts build` primeiro — **não**
   buildar implicitamente.
2. Importar o módulo buildado (`import(...)` dinâmico do caminho
   absoluto) e conferir:
   - `CONTRACT_VERSION` casa com `/^\d+\.\d+\.\d+$/`.
   - `CAPABILITIES` é exatamente
     `["storage", "queue", "topic", "secret", "logs"]`, nesta ordem.
   - `CAPABILITY_STATUSES` é exatamente
     `["available", "unavailable", "degraded"]`.
   - `HEALTH_FAILURE_CODES` é exatamente
     `["CONNECTION_TIMEOUT", "CONNECTION_REFUSED", "AUTH_FAILED", "UNKNOWN"]`.
3. Reportar todas as violações encontradas de uma vez (não parar na
   primeira), seguindo o padrão de acumular em `errors[]` já usado nos
   outros scripts.
