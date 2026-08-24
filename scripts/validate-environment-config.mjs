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
