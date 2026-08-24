import type { Environment } from "@eventpier/contracts";

const DEFAULT_ENDPOINT = "http://ministack:4566";

export class InvalidEnvironmentConfigError extends Error {}

function parseManaged(raw: string | undefined): boolean {
  if (raw === undefined || raw === "") {
    return true;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  throw new InvalidEnvironmentConfigError(
    `MINISTACK_MANAGED deve ser "true" ou "false", recebido: ${JSON.stringify(raw)}`,
  );
}

export function resolveEnvironmentConfig(): Environment {
  const managed = parseManaged(process.env.MINISTACK_MANAGED);
  const endpointRaw = process.env.MINISTACK_ENDPOINT?.trim();
  const endpoint = endpointRaw && endpointRaw.length > 0 ? endpointRaw : undefined;

  if (!managed && endpoint === undefined) {
    throw new InvalidEnvironmentConfigError(
      "MINISTACK_ENDPOINT é obrigatório quando MINISTACK_MANAGED=false — não há endpoint gerenciado padrão para apontar.",
    );
  }

  return {
    id: "ministack",
    endpoint: endpoint ?? DEFAULT_ENDPOINT,
    managed,
  };
}
