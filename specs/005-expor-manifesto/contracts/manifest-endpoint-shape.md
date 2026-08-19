# Contrato — Forma do Endpoint de Manifesto e Arquivos Relacionados (005)

Forma exata que `/tasks`/`/implement` devem produzir. Referência
normativa: `docs/arquitetura.md` §2 (árvore de arquivos) e §3
(Contrato Mínimo), refinada pelas decisões de `research.md`.

## Cenários HTTP (resumo normativo)

| Requisição | Status | Content-Type | Corpo |
|---|---|---|---|
| `GET /api/v1/manifest` | 200 | `application/json; charset=utf-8` | `ProviderManifest` (ver `data-model.md`) |
| `POST` / `PUT` / `DELETE` / etc. em `/api/v1/manifest` | 405 | `application/json; charset=utf-8` | `ProviderError` (`code: "METHOD_NOT_ALLOWED"`); header `Allow: GET` |
| `GET` (ou qualquer método) em qualquer outro path | 404 | `application/json; charset=utf-8` | `ProviderError` (`code: "NOT_FOUND"`) |

## `providers/aws/src/manifest/manifest.service.ts` (novo arquivo)

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CONTRACT_VERSION, type ProviderManifest } from "@eventpier/contracts";

const PACKAGE_JSON_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../package.json",
);

const { version: PROVIDER_VERSION } = JSON.parse(
  readFileSync(PACKAGE_JSON_PATH, "utf-8"),
) as { version: string };

export function buildManifest(): ProviderManifest {
  return {
    contractVersion: CONTRACT_VERSION,
    provider: { id: "aws", name: "AWS" },
    environment: { id: "ministack", managed: true },
    version: PROVIDER_VERSION,
    capabilities: [],
  };
}
```

## `providers/aws/src/index.ts` (substitui o placeholder da spec 003)

```ts
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { ProviderError } from "@eventpier/contracts";
import { buildManifest } from "./manifest/manifest.service.js";

const PORT = 4000;
const MANIFEST_PATH = "/api/v1/manifest";

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

function methodNotAllowed(res: ServerResponse, method: string | undefined): void {
  const error: ProviderError = {
    code: "METHOD_NOT_ALLOWED",
    message: `Método ${method} não suportado em ${MANIFEST_PATH}. Use GET.`,
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

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const path = (req.url ?? "/").split("?")[0];

  if (path === MANIFEST_PATH) {
    if (req.method === "GET") {
      sendJson(res, 200, buildManifest());
      return;
    }
    methodNotAllowed(res, req.method);
    return;
  }

  notFound(res, path);
});

server.listen(PORT, () => {
  console.log(`eventpier-aws ouvindo na porta ${PORT}`);
});
```

## `providers/aws/package.json` (campo novo)

```json
{
  "dependencies": {
    "@eventpier/contracts": "workspace:*"
  }
}
```

Adicionado ao `package.json` já existente (versão, scripts etc.
inalterados) — ver arquivo atual em `providers/aws/package.json`.

## `providers/aws/Dockerfile` (arquivo completo, substitui o da spec 003)

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/ui/package.json apps/ui/package.json
COPY providers/aws/package.json providers/aws/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY providers/aws providers/aws
RUN pnpm --filter @eventpier/contracts build
RUN pnpm --filter @eventpier/provider-aws build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/providers/aws/dist ./dist
COPY --from=build /app/providers/aws/package.json ./package.json
COPY --from=build /app/packages/contracts/dist ./node_modules/@eventpier/contracts/dist
COPY --from=build /app/packages/contracts/package.json ./node_modules/@eventpier/contracts/package.json
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

Diferença em relação ao Dockerfile atual (spec 003): o estágio `build`
agora também copia e builda `packages/contracts` (antes só seu
`package.json` era copiado, na etapa `deps`, para resolução de
workspace); o estágio `runtime` ganha as duas últimas linhas `COPY`,
recriando manualmente `node_modules/@eventpier/contracts/` (ver
`research.md`, Decisão 6).

## `scripts/validate-manifest-endpoint.mjs` (novo arquivo)

```js
#!/usr/bin/env node
// Valida o endpoint GET /api/v1/manifest do provider AWS em execução real,
// conforme specs/005-expor-manifesto/contracts/manifest-endpoint-shape.md.
// Sem dependências externas — mesmo padrão dos demais scripts em scripts/.
//
// Pressupõe que @eventpier/contracts e @eventpier/provider-aws já foram
// buildados. Não builda implicitamente — Build e Testes são gates
// separados e ordenados (mesmo padrão de validate-contract-constants.mjs).

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROVIDER_DIST_ENTRY = join(ROOT, "providers/aws/dist/index.js");
const CONTRACTS_DIST_ENTRY = join(ROOT, "packages/contracts/dist/index.js");
const BASE_URL = "http://localhost:4000";

function fail(errors) {
  console.error("FALHOU — validate-manifest-endpoint.mjs:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exitCode = 1;
}

for (const path of [PROVIDER_DIST_ENTRY, CONTRACTS_DIST_ENTRY]) {
  if (!existsSync(path)) {
    fail([
      `${path} não existe.`,
      "Rode os builds de @eventpier/contracts e @eventpier/provider-aws antes de validar o endpoint.",
    ]);
    process.exit();
  }
}

const contracts = await import(pathToFileURL(CONTRACTS_DIST_ENTRY).href);
const errors = [];

const child = spawn("node", [PROVIDER_DIST_ENTRY], {
  stdio: ["ignore", "pipe", "inherit"],
});

try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Timeout esperando o provider subir")),
      5000,
    );
    child.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("ouvindo na porta")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Provider encerrou antes de subir (exit code ${code})`));
    });
  });

  const manifestRes = await fetch(`${BASE_URL}/api/v1/manifest`);
  const manifestBody = await manifestRes.json();

  if (manifestRes.status !== 200) {
    errors.push(`GET /api/v1/manifest deveria retornar 200, retornou ${manifestRes.status}`);
  }
  if (manifestBody.contractVersion !== contracts.CONTRACT_VERSION) {
    errors.push(
      `contractVersion deveria ser ${JSON.stringify(contracts.CONTRACT_VERSION)}, encontrado ${JSON.stringify(manifestBody.contractVersion)}`,
    );
  }
  if (manifestBody.provider?.id !== "aws" || manifestBody.provider?.name !== "AWS") {
    errors.push(`provider deveria ser {id: "aws", name: "AWS"}, encontrado ${JSON.stringify(manifestBody.provider)}`);
  }
  if (manifestBody.environment?.id !== "ministack" || manifestBody.environment?.managed !== true) {
    errors.push(`environment deveria ser {id: "ministack", managed: true}, encontrado ${JSON.stringify(manifestBody.environment)}`);
  }
  if (typeof manifestBody.version !== "string" || manifestBody.version.length === 0) {
    errors.push(`version deveria ser string não vazia, encontrado ${JSON.stringify(manifestBody.version)}`);
  }
  if (!Array.isArray(manifestBody.capabilities) || manifestBody.capabilities.length !== 0) {
    errors.push(`capabilities deveria ser [], encontrado ${JSON.stringify(manifestBody.capabilities)}`);
  }

  const postRes = await fetch(`${BASE_URL}/api/v1/manifest`, { method: "POST" });
  const postBody = await postRes.json();
  if (postRes.status !== 405) {
    errors.push(`POST /api/v1/manifest deveria retornar 405, retornou ${postRes.status}`);
  }
  if (typeof postBody.code !== "string" || postBody.retryable !== false) {
    errors.push(`corpo de erro do POST deveria ser ProviderError com retryable: false, encontrado ${JSON.stringify(postBody)}`);
  }

  const notFoundRes = await fetch(`${BASE_URL}/caminho-desconhecido`);
  const notFoundBody = await notFoundRes.json();
  if (notFoundRes.status !== 404) {
    errors.push(`GET /caminho-desconhecido deveria retornar 404, retornou ${notFoundRes.status}`);
  }
  if (typeof notFoundBody.code !== "string" || notFoundBody.retryable !== false) {
    errors.push(`corpo de erro do 404 deveria ser ProviderError com retryable: false, encontrado ${JSON.stringify(notFoundBody)}`);
  }
} finally {
  child.kill();
}

if (errors.length > 0) {
  fail(errors);
} else {
  console.log("OK — GET /api/v1/manifest responde conforme o contrato (200/405/404)");
}
```
