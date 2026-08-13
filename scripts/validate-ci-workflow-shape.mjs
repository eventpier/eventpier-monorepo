#!/usr/bin/env node
// Valida a forma (gatilho, filtro de path, permissões, tags) dos
// workflows de CI contra specs/004-configurar-ci-path-providers/data-model.md
// e specs/004-configurar-ci-path-providers/contracts/ci-workflow-shape.md.
// Sem dependências externas — lê os arquivos YAML como texto (sem
// parser), já que a forma esperada é simples e estável o suficiente
// para checagem por regex (ver research.md desta spec, seção final).

import { existsSync, readFileSync } from "node:fs";

const CI_PATH = ".github/workflows/ci.yml";
const PUBLISH_PATH = ".github/workflows/publish-provider-aws.yml";

const errors = [];

function readOrReportMissing(path) {
  if (!existsSync(path)) {
    errors.push(`arquivo "${path}" não encontrado`);
    return null;
  }
  return readFileSync(path, "utf8");
}

function checkNoSecretsBeyondGithubToken(path, content) {
  const matches = content.match(/secrets\.[A-Za-z0-9_]+/g) ?? [];
  const unexpected = [...new Set(matches)].filter(
    (m) => m !== "secrets.GITHUB_TOKEN",
  );
  if (unexpected.length > 0) {
    errors.push(
      `"${path}" referencia segredo(s) além de secrets.GITHUB_TOKEN: ${unexpected.join(", ")} — viola requisito funcional 8 (spec.md)`,
    );
  }
}

// --- ci.yml: validação em todo PR, sem filtro de path ---
const ciContent = readOrReportMissing(CI_PATH);
if (ciContent) {
  if (!/^\s*pull_request:/m.test(ciContent)) {
    errors.push(`"${CI_PATH}" deveria disparar em pull_request`);
  }
  if (!/branches:\s*\[\s*main\s*\]/.test(ciContent)) {
    errors.push(`"${CI_PATH}" deveria restringir pull_request a branches: [main]`);
  }
  if (/^\s*paths:/m.test(ciContent)) {
    errors.push(
      `"${CI_PATH}" não deveria ter filtro de path — a validação precisa cobrir todo PR, qualquer workspace (requisito funcional 1, spec.md)`,
    );
  }

  const expectedSteps = [
    "tsc --noEmit",
    "pnpm --filter @eventpier/contracts build",
    "pnpm --filter @eventpier/provider-aws build",
    "pnpm --filter @eventpier/ui build",
    "docker compose build",
    "validate-workspace-manifests.mjs",
    "validate-workspace-dependencies.mjs",
    "validate-contract-constants.mjs",
    "validate-compose-shape.mjs",
    "validate-ci-workflow-shape.mjs",
  ];
  for (const step of expectedSteps) {
    if (!ciContent.includes(step)) {
      errors.push(`"${CI_PATH}" não contém o step esperado: "${step}"`);
    }
  }

  checkNoSecretsBeyondGithubToken(CI_PATH, ciContent);
}

// --- publish-provider-aws.yml: publish com gatilho por path, só em main ---
const publishContent = readOrReportMissing(PUBLISH_PATH);
if (publishContent) {
  if (!/^\s*push:/m.test(publishContent)) {
    errors.push(`"${PUBLISH_PATH}" deveria disparar em push (não pull_request)`);
  }
  if (/^\s*pull_request:/m.test(publishContent)) {
    errors.push(
      `"${PUBLISH_PATH}" não deveria disparar em pull_request — um required status check com filtro de path pode nunca rodar e travar merges (research.md, Decisão 2)`,
    );
  }
  if (!/branches:\s*\[\s*main\s*\]/.test(publishContent)) {
    errors.push(`"${PUBLISH_PATH}" deveria restringir push a branches: [main]`);
  }

  const requiredPaths = ["providers/aws/**", "packages/contracts/**"];
  for (const p of requiredPaths) {
    if (!publishContent.includes(p)) {
      errors.push(
        `"${PUBLISH_PATH}" não contém "${p}" no filtro de path — requisitos funcionais 3-4 (spec.md) exigem que o gatilho cubra tanto o provider quanto o contrato`,
      );
    }
  }

  if (!/packages:\s*write/.test(publishContent)) {
    errors.push(`"${PUBLISH_PATH}" deveria declarar permissions.packages: write`);
  }
  if (!/providers\/aws\/Dockerfile/.test(publishContent)) {
    errors.push(`"${PUBLISH_PATH}" deveria referenciar providers/aws/Dockerfile`);
  }
  if (!/latest/.test(publishContent)) {
    errors.push(`"${PUBLISH_PATH}" deveria incluir a tag "latest"`);
  }
  if (!/GITHUB_SHA|github\.sha/i.test(publishContent)) {
    errors.push(
      `"${PUBLISH_PATH}" deveria derivar uma tag do commit (GITHUB_SHA) — requisito funcional 6 (rastreabilidade)`,
    );
  }

  checkNoSecretsBeyondGithubToken(PUBLISH_PATH, publishContent);
}

if (errors.length > 0) {
  console.error("FALHOU — validate-ci-workflow-shape.mjs:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exitCode = 1;
} else {
  console.log("OK — forma dos workflows de CI bate com contracts/ci-workflow-shape.md");
}
