#!/usr/bin/env node
// Valida as constantes de runtime exportadas por packages/contracts/dist/index.js,
// conforme specs/002-definir-contrato-compartilhado/data-model.md.
// Sem dependências externas — só fs/path/assert do core do Node (mesmo padrão de
// validate-workspace-manifests.mjs / validate-workspace-dependencies.mjs, spec 001).
//
// Pressupõe que o pacote já foi buildado (`pnpm --filter @eventpier/contracts build`).
// Não builda implicitamente — Build e Testes são gates separados e ordenados
// (ver research.md, Decisão 7).

import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST_ENTRY = join(ROOT, "packages/contracts/dist/index.js");

const EXPECTED = {
  CAPABILITIES: ["storage", "queue", "topic", "secret", "logs"],
  CAPABILITY_STATUSES: ["available", "unavailable", "degraded"],
  HEALTH_FAILURE_CODES: [
    "CONNECTION_TIMEOUT",
    "CONNECTION_REFUSED",
    "AUTH_FAILED",
    "UNKNOWN",
  ],
};

if (!existsSync(DIST_ENTRY)) {
  console.error("FALHOU — validate-contract-constants.mjs:");
  console.error(`  - ${DIST_ENTRY} não existe.`);
  console.error(
    "  - Rode `pnpm --filter @eventpier/contracts build` antes de validar as constantes.",
  );
  process.exitCode = 1;
  process.exit();
}

const contract = await import(pathToFileURL(DIST_ENTRY).href);

const errors = [];

function checkArrayExact(name, actual, expected) {
  if (!Array.isArray(actual)) {
    errors.push(`${name} não é um array (encontrado: ${typeof actual})`);
    return;
  }
  const sameLength = actual.length === expected.length;
  const sameOrder = sameLength && expected.every((value, i) => actual[i] === value);
  if (!sameOrder) {
    errors.push(
      `${name} deveria ser ${JSON.stringify(expected)} (nesta ordem), encontrado ${JSON.stringify(actual)}`,
    );
  }
}

if (typeof contract.CONTRACT_VERSION !== "string" || !/^\d+\.\d+\.\d+$/.test(contract.CONTRACT_VERSION)) {
  errors.push(
    `CONTRACT_VERSION deveria ser uma string semver válida (ex.: "1.0.0"), encontrado ${JSON.stringify(contract.CONTRACT_VERSION)}`,
  );
}

checkArrayExact("CAPABILITIES", contract.CAPABILITIES, EXPECTED.CAPABILITIES);
checkArrayExact("CAPABILITY_STATUSES", contract.CAPABILITY_STATUSES, EXPECTED.CAPABILITY_STATUSES);
checkArrayExact("HEALTH_FAILURE_CODES", contract.HEALTH_FAILURE_CODES, EXPECTED.HEALTH_FAILURE_CODES);

if (errors.length > 0) {
  console.error("FALHOU — validate-contract-constants.mjs:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exitCode = 1;
} else {
  console.log("OK — constantes do contrato batem com data-model.md");
}
