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
  if (
    manifestBody.environment?.id !== "ministack" ||
    manifestBody.environment?.managed !== true ||
    manifestBody.environment?.endpoint !== "http://ministack:4566"
  ) {
    errors.push(`environment deveria ser {id: "ministack", endpoint: "http://ministack:4566", managed: true}, encontrado ${JSON.stringify(manifestBody.environment)}`);
  }
  if (typeof manifestBody.version !== "string" || manifestBody.version.length === 0) {
    errors.push(`version deveria ser string não vazia, encontrado ${JSON.stringify(manifestBody.version)}`);
  }
  const [storageCapability, ...restCapabilities] = manifestBody.capabilities ?? [];
  if (
    !Array.isArray(manifestBody.capabilities) ||
    manifestBody.capabilities.length !== 1 ||
    restCapabilities.length !== 0 ||
    storageCapability?.id !== "storage" ||
    storageCapability?.status !== "unavailable" ||
    typeof storageCapability?.reason !== "string"
  ) {
    errors.push(
      `capabilities deveria ter exatamente 1 item {id: "storage", status: "unavailable", reason: <string>} (MiniStack não acessível neste script), encontrado ${JSON.stringify(manifestBody.capabilities)}`,
    );
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
