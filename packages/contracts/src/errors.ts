import type { Capability } from "./manifest.js";

export interface ProviderError {
  code: string;
  message: string;
  capability?: Capability;
  retryable: boolean;
}
