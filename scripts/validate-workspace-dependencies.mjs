#!/usr/bin/env node
// Valida as invariantes de dependência de specs/001-setup-monorepo-workspaces/data-model.md:
// - packages/contracts nunca depende de @eventpier/ui nem @eventpier/provider-aws.
// - apps/ui e providers/aws só podem depender de @eventpier/contracts entre workspaces do monorepo.
//
// Nota: enquanto nenhum workspace existir (antes da Fase Core desta spec), este script não tem
// nada para violar e termina em OK — a proteção real passa a valer depois que os workspaces
// forem criados (ver tasks.md T005/T014). Isso é esperado, não um bug do script.

import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const MONOREPO_PACKAGE_NAMES = [
  "@eventpier/ui",
  "@eventpier/provider-aws",
  "@eventpier/contracts",
];

const WORKSPACES = [
  { path: "apps/ui", name: "@eventpier/ui", forbiddenDeps: ["@eventpier/ui", "@eventpier/provider-aws"] },
  { path: "providers/aws", name: "@eventpier/provider-aws", forbiddenDeps: ["@eventpier/ui", "@eventpier/provider-aws"] },
  { path: "packages/contracts", name: "@eventpier/contracts", forbiddenDeps: ["@eventpier/ui", "@eventpier/provider-aws"] },
];

const errors = [];

function allDeps(pkg) {
  return { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
}

for (const { path, name, forbiddenDeps } of WORKSPACES) {
  const pkgPath = join(ROOT, path, "package.json");
  if (!existsSync(pkgPath)) continue; // nada a validar ainda — ver nota no topo

  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const deps = allDeps(pkg);

  for (const dep of Object.keys(deps)) {
    if (!MONOREPO_PACKAGE_NAMES.includes(dep)) continue; // dependência externa, fora do escopo desta checagem
    if (dep === name) {
      errors.push(`${path}/package.json depende de si mesmo (${dep})`);
    } else if (forbiddenDeps.includes(dep)) {
      errors.push(`${path}/package.json não pode depender de ${dep} (ver data-model.md, invariantes)`);
    }
  }
}

if (errors.length > 0) {
  console.error("FALHOU — validate-workspace-dependencies.mjs:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exitCode = 1;
} else {
  console.log("OK — nenhuma dependência entre workspaces viola data-model.md");
}
