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
