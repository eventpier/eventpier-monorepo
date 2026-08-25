import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { ProviderError } from "@eventpier/contracts";
import {
  InvalidEnvironmentConfigError,
  resolveEnvironmentConfig,
} from "./config/environment.config.js";
import { buildManifest } from "./manifest/manifest.service.js";
import { createHealthCache } from "./manifest/health-cache.js";
import { createMiniStackStorageAdapter } from "./adapters/ministack/storage.adapter.js";
import {
  createStorageHealthCheck,
  getStorageCapabilityDescriptor,
  listBuckets,
  listObjects,
} from "./capabilities/storage.controller.js";

const PORT = 4000;
const MANIFEST_PATH = "/api/v1/manifest";
const STORAGE_BUCKETS_PATH = "/api/v1/storage/buckets";
const STORAGE_BUCKET_OBJECTS_PATTERN = /^\/api\/v1\/storage\/buckets\/([^/]+)\/objects$/;

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

function methodNotAllowed(res: ServerResponse, method: string | undefined, path: string): void {
  const error: ProviderError = {
    code: "METHOD_NOT_ALLOWED",
    message: `Método ${method} não suportado em ${path}. Use GET.`,
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

function storageErrorStatus(error: ProviderError): number {
  switch (error.code) {
    case "RESOURCE_NOT_FOUND":
      return 404;
    case "CONNECTION_FAILED":
      return 503;
    default:
      return 500;
  }
}

function badRequest(res: ServerResponse, message: string): void {
  const error: ProviderError = { code: "BAD_REQUEST", message, retryable: false };
  sendJson(res, 400, error);
}

function internalError(res: ServerResponse, err: unknown): void {
  console.error("eventpier-aws: erro inesperado tratando requisição —", err);
  const error: ProviderError = {
    code: "UNKNOWN",
    message: "Erro inesperado ao processar a requisição.",
    retryable: false,
  };
  sendJson(res, 500, error);
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

// resolveEnvironmentConfig() garante endpoint sempre preenchido quando tem
// sucesso (specs/007-configurar-environment/data-model.md) — asserção, não
// fallback silencioso, para falhar alto se esse invariante for quebrado.
const storageAdapter = createMiniStackStorageAdapter(environment.endpoint!);
const storageHealthCache = createHealthCache(createStorageHealthCheck(storageAdapter));

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // Boundary do processo HTTP: qualquer exceção síncrona não capturada aqui
  // (ex.: decodeURIComponent de um segmento de path malformado) rejeitaria
  // esta função async sem handler — Node encerra o processo por padrão em
  // promise rejeitada não tratada. Nunca deixar essa rejeição escapar.
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;

    if (path === MANIFEST_PATH) {
      if (req.method === "GET") {
        const storageDescriptor = await getStorageCapabilityDescriptor(storageHealthCache);
        sendJson(res, 200, buildManifest(environment, [storageDescriptor]));
        return;
      }
      methodNotAllowed(res, req.method, MANIFEST_PATH);
      return;
    }

    if (path === STORAGE_BUCKETS_PATH) {
      if (req.method === "GET") {
        const cursor = url.searchParams.get("cursor") ?? undefined;
        const result = await listBuckets(storageAdapter, storageHealthCache, cursor);
        if (result.ok) {
          sendJson(res, 200, result.page);
        } else {
          sendJson(res, storageErrorStatus(result.error), result.error);
        }
        return;
      }
      methodNotAllowed(res, req.method, STORAGE_BUCKETS_PATH);
      return;
    }

    const objectsMatch = path.match(STORAGE_BUCKET_OBJECTS_PATTERN);
    if (objectsMatch) {
      if (req.method === "GET") {
        let bucket: string;
        try {
          bucket = decodeURIComponent(objectsMatch[1]);
        } catch {
          badRequest(res, "Segmento de bucket contém percent-encoding inválido.");
          return;
        }
        const prefix = url.searchParams.get("prefix") ?? undefined;
        const cursor = url.searchParams.get("cursor") ?? undefined;
        const result = await listObjects(storageAdapter, storageHealthCache, bucket, prefix, cursor);
        if (result.ok) {
          sendJson(res, 200, result.page);
        } else {
          sendJson(res, storageErrorStatus(result.error), result.error);
        }
        return;
      }
      methodNotAllowed(res, req.method, path);
      return;
    }

    notFound(res, path);
  } catch (err) {
    internalError(res, err);
  }
});

server.listen(PORT, () => {
  console.log(`eventpier-aws ouvindo na porta ${PORT}`);
});
