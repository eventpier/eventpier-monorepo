export const CONTRACT_VERSION = "1.0.0";

export const CAPABILITIES = [
  "storage",
  "queue",
  "topic",
  "secret",
  "logs",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_STATUSES = [
  "available",
  "unavailable",
  "degraded",
] as const;
export type CapabilityStatus = (typeof CAPABILITY_STATUSES)[number];

export const HEALTH_FAILURE_CODES = [
  "CONNECTION_TIMEOUT",
  "CONNECTION_REFUSED",
  "AUTH_FAILED",
  "UNKNOWN",
] as const;
export type HealthFailureCode = (typeof HEALTH_FAILURE_CODES)[number];

export interface Provider {
  id: string;
  name: string;
}

export interface Environment {
  id: string;
  endpoint?: string;
  managed: boolean;
}

export interface CapabilityDescriptor {
  id: Capability;
  status: CapabilityStatus;
  reason?: HealthFailureCode;
}

export interface ProviderManifest {
  contractVersion: string;
  provider: Provider;
  environment: Environment;
  version: string;
  capabilities: CapabilityDescriptor[];
}
