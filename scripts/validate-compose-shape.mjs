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

if (errors.length > 0) {
  console.error("FALHOU — validate-compose-shape.mjs:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exitCode = 1;
} else {
  console.log("OK — topologia de docker-compose.yml bate com data-model.md");
}
