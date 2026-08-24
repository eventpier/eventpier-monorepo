# Contrato — Forma do Módulo de EnvironmentConfig e Arquivos Relacionados (007)

Forma exata que `/tasks`/`/implement` devem produzir. Referência
normativa: `docs/arquitetura.md` §5 (Configuração de Environment),
refinada pelas decisões de `research.md` e pelo modelo de
`data-model.md`.

## `providers/aws/src/config/environment.config.ts` (novo arquivo)

```ts
import type { Environment } from "@eventpier/contracts";

const DEFAULT_ENDPOINT = "http://ministack:4566";

export class InvalidEnvironmentConfigError extends Error {}

function parseManaged(raw: string | undefined): boolean {
  if (raw === undefined || raw === "") {
    return true;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  throw new InvalidEnvironmentConfigError(
    `MINISTACK_MANAGED deve ser "true" ou "false", recebido: ${JSON.stringify(raw)}`,
  );
}

export function resolveEnvironmentConfig(): Environment {
  const managed = parseManaged(process.env.MINISTACK_MANAGED);
  const endpointRaw = process.env.MINISTACK_ENDPOINT;
  const endpoint = endpointRaw && endpointRaw.length > 0 ? endpointRaw : undefined;

  if (!managed && endpoint === undefined) {
    throw new InvalidEnvironmentConfigError(
      "MINISTACK_ENDPOINT é obrigatório quando MINISTACK_MANAGED=false — não há endpoint gerenciado padrão para apontar.",
    );
  }

  return {
    id: "ministack",
    endpoint: endpoint ?? DEFAULT_ENDPOINT,
    managed,
  };
}
```

## `providers/aws/src/config/environment.config.test.ts` (novo arquivo)

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  InvalidEnvironmentConfigError,
  resolveEnvironmentConfig,
} from "./environment.config.js";

describe("resolveEnvironmentConfig", () => {
  const originalEndpoint = process.env.MINISTACK_ENDPOINT;
  const originalManaged = process.env.MINISTACK_MANAGED;

  beforeEach(() => {
    delete process.env.MINISTACK_ENDPOINT;
    delete process.env.MINISTACK_MANAGED;
  });

  afterEach(() => {
    if (originalEndpoint === undefined) {
      delete process.env.MINISTACK_ENDPOINT;
    } else {
      process.env.MINISTACK_ENDPOINT = originalEndpoint;
    }
    if (originalManaged === undefined) {
      delete process.env.MINISTACK_MANAGED;
    } else {
      process.env.MINISTACK_MANAGED = originalManaged;
    }
  });

  it("sem nenhuma variável de ambiente, retorna o default gerenciado", () => {
    expect(resolveEnvironmentConfig()).toEqual({
      id: "ministack",
      endpoint: "http://ministack:4566",
      managed: true,
    });
  });

  it("com MINISTACK_ENDPOINT customizado e managed ausente, mantém managed: true", () => {
    process.env.MINISTACK_ENDPOINT = "http://localhost:4566";

    expect(resolveEnvironmentConfig()).toEqual({
      id: "ministack",
      endpoint: "http://localhost:4566",
      managed: true,
    });
  });

  it.each(["true", "TRUE", "True"])(
    "aceita MINISTACK_MANAGED=%s (case-insensitive)",
    (value) => {
      process.env.MINISTACK_MANAGED = value;

      expect(resolveEnvironmentConfig().managed).toBe(true);
    },
  );

  it("com managed: false e endpoint customizado, reflete exatamente os dois", () => {
    process.env.MINISTACK_MANAGED = "false";
    process.env.MINISTACK_ENDPOINT = "http://host.docker.internal:4566";

    expect(resolveEnvironmentConfig()).toEqual({
      id: "ministack",
      endpoint: "http://host.docker.internal:4566",
      managed: false,
    });
  });

  it("lança InvalidEnvironmentConfigError quando managed: false sem endpoint", () => {
    process.env.MINISTACK_MANAGED = "false";

    expect(() => resolveEnvironmentConfig()).toThrow(
      InvalidEnvironmentConfigError,
    );
  });

  it("lança InvalidEnvironmentConfigError para um valor de MINISTACK_MANAGED não reconhecível", () => {
    process.env.MINISTACK_MANAGED = "talvez";

    expect(() => resolveEnvironmentConfig()).toThrow(
      InvalidEnvironmentConfigError,
    );
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

export function buildManifest(environment: Environment): ProviderManifest {
  return {
    contractVersion: CONTRACT_VERSION,
    provider: { id: "aws", name: "AWS" },
    environment,
    version: PROVIDER_VERSION,
    capabilities: [],
  };
}
```

Único trecho alterado: assinatura de `buildManifest()` para
`buildManifest(environment: Environment)`, e `environment: { id:
"ministack", managed: true }` vira `environment` (o parâmetro
recebido). Nenhuma outra linha muda.

## `providers/aws/src/index.ts` (alterado)

```ts
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { ProviderError } from "@eventpier/contracts";
import {
  InvalidEnvironmentConfigError,
  resolveEnvironmentConfig,
} from "./config/environment.config.js";
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

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const path = (req.url ?? "/").split("?")[0];

  if (path === MANIFEST_PATH) {
    if (req.method === "GET") {
      sendJson(res, 200, buildManifest(environment));
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

Mudanças em relação ao arquivo atual: dois novos imports; bloco
`resolveEnvironmentConfig()`/try-catch antes da criação do `server`
(fail-fast); `buildManifest()` vira `buildManifest(environment)` no
handler. Nenhuma outra linha muda — `sendJson`, `methodNotAllowed`,
`notFound` e o roteamento permanecem idênticos.

## `scripts/validate-manifest-endpoint.mjs` (alterado — uma linha)

A asserção existente de `environment`:

```js
if (manifestBody.environment?.id !== "ministack" || manifestBody.environment?.managed !== true) {
  errors.push(`environment deveria ser {id: "ministack", managed: true}, encontrado ${JSON.stringify(manifestBody.environment)}`);
}
```

vira:

```js
if (
  manifestBody.environment?.id !== "ministack" ||
  manifestBody.environment?.managed !== true ||
  manifestBody.environment?.endpoint !== "http://ministack:4566"
) {
  errors.push(`environment deveria ser {id: "ministack", endpoint: "http://ministack:4566", managed: true}, encontrado ${JSON.stringify(manifestBody.environment)}`);
}
```

Nenhuma outra linha do script muda — continua spawnando o processo sem
nenhuma variável de ambiente customizada (cenário default).

## `scripts/validate-environment-config.mjs` (novo arquivo)

```js
#!/usr/bin/env node
// Valida o comportamento de EnvironmentConfig (endpoint/managed) do
// provider AWS em execução real, conforme
// specs/007-configurar-environment/data-model.md. Mesmo padrão de
// scripts/validate-manifest-endpoint.mjs: spawna providers/aws/dist/index.js
// de verdade, sem dependências externas.
//
// Pressupõe que @eventpier/contracts e @eventpier/provider-aws já foram
// buildados. Não builda implicitamente.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROVIDER_DIST_ENTRY = join(ROOT, "providers/aws/dist/index.js");
const BASE_URL = "http://localhost:4000";

const errors = [];

for (const path of [PROVIDER_DIST_ENTRY]) {
  if (!existsSync(path)) {
    console.error("FALHOU — validate-environment-config.mjs:");
    console.error(`  - ${path} não existe. Rode o build de @eventpier/provider-aws antes de validar.`);
    process.exit(1);
  }
}

function runProvider(env) {
  return new Promise((resolve) => {
    const child = spawn("node", [PROVIDER_DIST_ENTRY], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    const timeout = setTimeout(() => {
      child.kill();
      resolve({ started: false, exitCode: null, stderr, timedOut: true });
    }, 3000);

    child.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("ouvindo na porta")) {
        clearTimeout(timeout);
        resolve({ started: true, exitCode: null, stderr, child });
      }
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);
      resolve({ started: false, exitCode: code, stderr, timedOut: false });
    });
  });
}

// Cenário 1: managed: false + endpoint customizado válido — deve subir
// e refletir exatamente o configurado.
{
  const result = await runProvider({
    MINISTACK_MANAGED: "false",
    MINISTACK_ENDPOINT: "http://host.docker.internal:4566",
  });

  if (!result.started) {
    errors.push(
      `Cenário managed:false + endpoint customizado deveria subir o processo, mas não subiu (exitCode=${result.exitCode}, timedOut=${result.timedOut})`,
    );
  } else {
    const res = await fetch(`${BASE_URL}/api/v1/manifest`);
    const body = await res.json();
    if (
      body.environment?.id !== "ministack" ||
      body.environment?.managed !== false ||
      body.environment?.endpoint !== "http://host.docker.internal:4566"
    ) {
      errors.push(
        `Cenário managed:false + endpoint customizado: environment deveria refletir a configuração, encontrado ${JSON.stringify(body.environment)}`,
      );
    }
    result.child.kill();
  }
}

// Cenário 2: managed: false sem endpoint — deve falhar ao iniciar.
{
  const result = await runProvider({ MINISTACK_MANAGED: "false" });

  if (result.started) {
    errors.push(
      "Cenário managed:false sem endpoint deveria falhar ao iniciar, mas o processo subiu e passou a escutar a porta",
    );
    result.child.kill();
  } else if (result.timedOut) {
    errors.push(
      "Cenário managed:false sem endpoint: processo nem subiu nem encerrou dentro do timeout — comportamento inesperado",
    );
  } else if (result.exitCode === 0) {
    errors.push(
      "Cenário managed:false sem endpoint deveria encerrar com código de saída diferente de zero",
    );
  }
}

// Cenário 3: MINISTACK_MANAGED com valor não reconhecível — deve falhar
// ao iniciar.
{
  const result = await runProvider({ MINISTACK_MANAGED: "talvez" });

  if (result.started) {
    errors.push(
      "Cenário MINISTACK_MANAGED inválido deveria falhar ao iniciar, mas o processo subiu e passou a escutar a porta",
    );
    result.child.kill();
  } else if (result.timedOut) {
    errors.push(
      "Cenário MINISTACK_MANAGED inválido: processo nem subiu nem encerrou dentro do timeout — comportamento inesperado",
    );
  } else if (result.exitCode === 0) {
    errors.push(
      "Cenário MINISTACK_MANAGED inválido deveria encerrar com código de saída diferente de zero",
    );
  }
}

if (errors.length > 0) {
  console.error("FALHOU — validate-environment-config.mjs:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exitCode = 1;
} else {
  console.log("OK — EnvironmentConfig (endpoint/managed) se comporta conforme data-model.md");
}
```

## `.pipeline/quality-gates.md` (alterado)

Linha "Testes de integração" ganha
`node scripts/validate-environment-config.mjs` ao final da cadeia de
comandos já existente (após `validate-manifest-endpoint.mjs`).
Parágrafo explicativo abaixo da tabela ganha uma frase descrevendo o
novo script, no mesmo padrão das entradas anteriores (o que valida, do
que depende).

## `.github/workflows/ci.yml` (alterado)

Step "Testes de integração (scripts de validação estrutural)" ganha
`node scripts/validate-environment-config.mjs` como última linha do
bloco `run:`, após `node scripts/validate-manifest-endpoint.mjs`.
