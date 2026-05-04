import { AnthropicProvider } from '@/lib/llm/anthropic';
import { GeminiProvider } from '@/lib/llm/gemini';
import type { AnalysisInput, AnalysisResult, LLMProvider, ProviderName } from '@/lib/llm/types';

export type { AnalysisInput, AnalysisResult, LLMProvider, ProviderName } from '@/lib/llm/types';

const VALID_PROVIDERS: ProviderName[] = ['anthropic', 'gemini'];
const DEFAULT_PROVIDER: ProviderName = 'gemini';

let cachedAnthropic: AnthropicProvider | null = null;
let cachedGemini: GeminiProvider | null = null;

/**
 * Resolve the active LLM provider from `process.env.LLM_PROVIDER`.
 *
 * Defaults to `gemini` (free tier) so dev environments don't burn paid
 * Anthropic credits by accident. Providers are lazily instantiated, so a
 * missing API key for the *unused* provider does not crash startup.
 *
 * @throws if LLM_PROVIDER is set to an unsupported value.
 */
export function getLLMProvider(): LLMProvider {
  const raw = process.env.LLM_PROVIDER?.trim().toLowerCase();
  const name: ProviderName = raw ? coerceProvider(raw) : DEFAULT_PROVIDER;

  if (name === 'anthropic') {
    if (!cachedAnthropic) cachedAnthropic = new AnthropicProvider();
    return cachedAnthropic;
  }
  if (!cachedGemini) cachedGemini = new GeminiProvider();
  return cachedGemini;
}

/**
 * Convenience wrapper so call sites stay one line:
 * `const result = await analyzePR({ prMeta, structuralDiff })`.
 *
 * Future fallback / retry logic should live here, not in consumers.
 */
export async function analyzePR(input: AnalysisInput): Promise<AnalysisResult> {
  return getLLMProvider().analyzePR(input);
}

function coerceProvider(value: string): ProviderName {
  if (value === 'anthropic' || value === 'gemini') return value;
  throw new Error(
    `LLM_PROVIDER="${value}" is not supported. Valid values: ${VALID_PROVIDERS.join(', ')}`
  );
}
