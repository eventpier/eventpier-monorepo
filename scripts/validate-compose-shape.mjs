#!/usr/bin/env node
// Valida a topologia resolvida de docker-compose.yml contra
// specs/003-configurar-docker-compose/data-model.md e
// specs/003-configurar-docker-compose/contracts/compose-shape.md.
// Sem dependências externas — usa `docker compose config` (já resolve
// substituição de variáveis de ambiente) e node:child_process do core.
//
// Pressupõe que docker-compose.yml já existe. Não builda nem sobe
// nenhum serviço — só inspeciona a configuração resolvida.

import { execFileSync } from "node:child_process";

const errors = [];
let config;

try {
  // --profile managed-env: sem isso, `docker compose config` omite
  // serviços com profile (ex.: `ministack`) da saída por padrão — a
  // mesma filtragem aplicada a `up`/`ps`. Precisamos da forma completa
  // para validar `ministack` também.
  const raw = execFileSync(
    "docker",
    ["compose", "--profile", "managed-env", "config", "--format", "json"],
    { encoding: "utf8" },
  );
  config = JSON.parse(raw);
} catch (err) {
  console.error("FALHOU — validate-compose-shape.mjs:");
  console.error("  - `docker compose config --format json` não pôde ser executado/parseado.");
  console.error(
    "  - Confirme que docker-compose.yml existe na raiz e que os Dockerfiles referenciados existem, e que o Docker está instalado.",
  );
  console.error(`  - Detalhe: ${err.message}`);
  process.exitCode = 1;
  process.exit();
}

const services = config.services ?? {};

function checkPublishedPort(serviceName, expectedPublished) {
  const svc = services[serviceName];
  if (!svc) {
    errors.push(`serviço "${serviceName}" não encontrado em docker-compose.yml`);
    return;
  }
  const ports = svc.ports ?? [];
  const found = ports.some(
    (p) => String(p.published) === String(expectedPublished),
  );
  if (!found) {
    errors.push(
      `serviço "${serviceName}" deveria publicar a porta ${expectedPublished} ao host, encontrado: ${JSON.stringify(ports)}`,
    );
  }
}

function checkNoPublishedPort(serviceName) {
  const svc = services[serviceName];
  if (!svc) {
    errors.push(`serviço "${serviceName}" não encontrado em docker-compose.yml`);
    return;
  }
  const ports = svc.ports ?? [];
  if (ports.length > 0) {
    errors.push(
      `serviço "${serviceName}" não deveria publicar nenhuma porta ao host (constitution, princípio 11) — encontrado: ${JSON.stringify(ports)}`,
    );
  }
}

function checkProfile(serviceName, expectedProfile) {
  const svc = services[serviceName];
  if (!svc) {
    errors.push(`serviço "${serviceName}" não encontrado em docker-compose.yml`);
    return;
  }
  const profiles = svc.profiles ?? [];
  if (!profiles.includes(expectedProfile)) {
    errors.push(
      `serviço "${serviceName}" deveria ter profile "${expectedProfile}", encontrado: ${JSON.stringify(profiles)}`,
    );
  }
}

function checkEndpointNotDefaultedByCompose() {
  // Achado do Codex na PR #14 (spec 007): se docker-compose.yml
  // resolvesse MINISTACK_ENDPOINT para um default literal quando a
  // variável não está definida no host, esse valor ficaria
  // indistinguível de um endpoint real customizado pelo usuário —
  // mascarando exatamente o caso que providers/aws/src/config/
  // environment.config.ts precisa detectar como "ausente" para
  // disparar o fail-fast de managed:false sem endpoint (RF5,
  // spec.md). O default de endpoint deve vir só do código do
  // provider, nunca do Compose.
  let raw;
  try {
    raw = execFileSync("docker", ["compose", "config", "--format", "json"], {
      encoding: "utf8",
      env: { ...process.env, MINISTACK_ENDPOINT: "", MINISTACK_MANAGED: "" },
    });
  } catch (err) {
    errors.push(
      `não foi possível rodar \`docker compose config\` com MINISTACK_ENDPOINT vazio para validar o não-vazamento do default: ${err.message}`,
    );
    return;
  }
  const cfg = JSON.parse(raw);
  const resolvedEndpoint = cfg.services?.["eventpier-aws"]?.environment?.MINISTACK_ENDPOINT;
  if (resolvedEndpoint) {
    errors.push(
      `com MINISTACK_ENDPOINT não definida no host, docker-compose.yml resolveu eventpier-aws.environment.MINISTACK_ENDPOINT para "${resolvedEndpoint}" em vez de vazio/ausente — isso mascara a ausência de endpoint e impede o fail-fast de managed:false sem endpoint (achado do Codex, PR #14, spec 007)`,
    );
  }
}

function checkNetwork(networkName, expectedDriver) {
  const networks = config.networks ?? {};
  const net = networks[networkName];
  if (!net) {
    errors.push(`rede "${networkName}" não encontrada em docker-compose.yml`);
    return;
  }
  if (net.driver !== expectedDriver) {
    errors.push(
      `rede "${networkName}" deveria usar driver "${expectedDriver}", encontrado "${net.driver}"`,
    );
  }
}

checkPublishedPort("eventpier-ui", 3000);
checkNoPublishedPort("eventpier-aws");
checkPublishedPort("ministack", 4566);
checkProfile("ministack", "managed-env");
checkNetwork("eventpier-net", "bridge");
checkEndpointNotDefaultedByCompose();

if (errors.length > 0) {
  console.error("FALHOU — validate-compose-shape.mjs:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exitCode = 1;
} else {
  console.log("OK — topologia de docker-compose.yml bate com data-model.md");
}
