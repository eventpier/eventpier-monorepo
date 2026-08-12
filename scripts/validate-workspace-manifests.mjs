#!/usr/bin/env node
// Valida a estrutura descrita em specs/001-setup-monorepo-workspaces/contracts/workspace-manifest.md.
// Sem dependências externas — só fs/path do core do Node (ver research.md, "Nota de abordagem de teste").

import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const EXPECTED_WORKSPACE_PATTERNS = ["apps/*", "providers/*", "packages/*"];

const EXPECTED_WORKSPACES = [
  { path: "apps/ui", name: "@eventpier/ui" },
  { path: "providers/aws", name: "@eventpier/provider-aws" },
  { path: "packages/contracts", name: "@eventpier/contracts" },
];

const errors = [];

function checkWorkspaceYaml() {
  const p = join(ROOT, "pnpm-workspace.yaml");
  if (!existsSync(p)) {
    errors.push(`pnpm-workspace.yaml não encontrado em ${p}`);
    return;
  }
  const content = readFileSync(p, "utf8");
  for (const pattern of EXPECTED_WORKSPACE_PATTERNS) {
    if (!content.includes(pattern)) {
      errors.push(`pnpm-workspace.yaml não lista o pattern "${pattern}"`);
    }
  }
}

function checkWorkspaceManifest({ path, name }) {
  const pkgPath = join(ROOT, path, "package.json");
  if (!existsSync(pkgPath)) {
    errors.push(`${path}/package.json não existe`);
    return;
  }

  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  } catch (err) {
    errors.push(`${path}/package.json não é um JSON válido: ${err.message}`);
    return;
  }

  if (pkg.name !== name) {
    errors.push(`${path}/package.json: "name" deveria ser "${name}", encontrado "${pkg.name}"`);
  }
  if (!/^\d+\.\d+\.\d+/.test(pkg.version ?? "")) {
    errors.push(`${path}/package.json: "version" deveria ser semver válido, encontrado "${pkg.version}"`);
  }
  if (pkg.version === "0.0.0") {
    errors.push(`${path}/package.json: "version" não pode ser "0.0.0" (constitution, princípio 13)`);
  }
  if (pkg.private !== true) {
    errors.push(`${path}/package.json: "private" deveria ser true, encontrado ${pkg.private}`);
  }
  if (pkg.type !== "module") {
    errors.push(`${path}/package.json: "type" deveria ser "module", encontrado "${pkg.type}"`);
  }
  if (typeof pkg.scripts !== "object" || pkg.scripts === null) {
    errors.push(`${path}/package.json: "scripts" deveria estar presente (mesmo vazio)`);
  }
}

checkWorkspaceYaml();
for (const workspace of EXPECTED_WORKSPACES) {
  checkWorkspaceManifest(workspace);
}

if (errors.length > 0) {
  console.error("FALHOU — validate-workspace-manifests.mjs:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exitCode = 1;
} else {
  console.log("OK — todos os manifestos de workspace seguem contracts/workspace-manifest.md");
}
