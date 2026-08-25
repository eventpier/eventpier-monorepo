import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  CONTRACT_VERSION,
  type CapabilityDescriptor,
  type Environment,
  type ProviderManifest,
} from "@eventpier/contracts";

const PACKAGE_JSON_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../package.json",
);

const { version: PROVIDER_VERSION } = JSON.parse(
  readFileSync(PACKAGE_JSON_PATH, "utf-8"),
) as { version: string };

export function buildManifest(
  environment: Environment,
  capabilities: CapabilityDescriptor[],
): ProviderManifest {
  return {
    contractVersion: CONTRACT_VERSION,
    provider: { id: "aws", name: "AWS" },
    environment,
    version: PROVIDER_VERSION,
    capabilities,
  };
}
