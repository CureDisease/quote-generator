import type { AiSettings } from "../types";
import type { QuoteAiProvider } from "./provider";
import { sampleProvider } from "./sample";
import { anthropicProvider } from "./anthropic";

const PROVIDERS: Record<string, QuoteAiProvider> = {
  sample: sampleProvider,
  anthropic: anthropicProvider,
  // openai: openaiProvider,  // drop in another provider here later
};

/**
 * Resolve the provider the company has selected. Unknown/unconfigured
 * providers fall back to the built-in sample estimator so the framework keeps
 * working before/without a connected AI.
 */
export function providerFor(settings: AiSettings): QuoteAiProvider {
  return PROVIDERS[settings.provider] ?? sampleProvider;
}

export function availableProviders(): string[] {
  return Object.keys(PROVIDERS);
}
