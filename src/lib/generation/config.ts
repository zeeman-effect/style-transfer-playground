import type { ProviderId, ProviderKeys } from "./types";

function isNonEmptyKey(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasProviderKey(
  keys: ProviderKeys,
  provider: ProviderId,
): boolean {
  return isNonEmptyKey(keys[provider]);
}

export function getConfiguredProviders(
  keys: ProviderKeys,
): Record<ProviderId, boolean> {
  return {
    google: hasProviderKey(keys, "google"),
    openai: hasProviderKey(keys, "openai"),
  };
}

export function providerNotConfiguredMessage(provider: ProviderId): string {
  const label = provider === "google" ? "Google" : "OpenAI";
  return `${label} is not configured. Add a ${label} API key in Settings to generate with this model.`;
}
