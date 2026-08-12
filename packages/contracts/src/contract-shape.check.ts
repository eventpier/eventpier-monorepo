// Verificação de forma em tempo de compilação — não é API pública
// (não reexportado por index.ts). Só existe para o gate Typecheck
// (`tsc --noEmit`) detectar regressão de forma do contrato. Ver
// specs/002-definir-contrato-compartilhado/research.md, Decisão 7.

import type {
  CapabilityDescriptor,
  Page,
  ProviderError,
  ProviderManifest,
} from "./index.js";
import { CONTRACT_VERSION } from "./manifest.js";

const availableCapability: CapabilityDescriptor = {
  id: "storage",
  status: "available",
  // reason omitido de propósito — "available" não deve ter reason (data-model.md)
};

const unavailableCapability: CapabilityDescriptor = {
  id: "queue",
  status: "unavailable",
  reason: "CONNECTION_REFUSED", // obrigatório por convenção quando "unavailable"
};

const exampleManifest: ProviderManifest = {
  contractVersion: CONTRACT_VERSION,
  provider: { id: "aws", name: "AWS" },
  environment: { id: "ministack", managed: true },
  version: "0.1.0",
  capabilities: [availableCapability, unavailableCapability],
};

const examplePage: Page<{ id: string }> = {
  items: [{ id: "example" }],
  // nextCursor omitido de propósito — ausência = fim da paginação (data-model.md)
};

const exampleError: ProviderError = {
  code: "RESOURCE_NOT_FOUND",
  message: "Bucket não encontrado",
  capability: "storage",
  retryable: false,
};

// Estados inválidos que a interface permite estruturalmente, mas que
// violam a invariante de data-model.md — documentados aqui, nunca
// escritos como código (quebrariam o gate Typecheck de propósito):
//   { id: "storage", status: "available", reason: "UNKNOWN" }  // inválido: available não tem reason
//   { id: "storage", status: "unavailable" }                    // inválido: unavailable exige reason

// Silencia "declared but never read" sem exportar estes exemplos como API pública.
void exampleManifest;
void examplePage;
void exampleError;
