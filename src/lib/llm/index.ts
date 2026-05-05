import { AnthropicProvider } from '@/lib/llm/anthropic';
import { GeminiProvider } from '@/lib/llm/gemini';
import { GroqProvider } from '@/lib/llm/groq';
import { DeepSeekProvider } from '@/lib/llm/deepseek';
import type { AnalysisInput, AnalysisResult, LLMProvider, ProviderName } from '@/lib/llm/types';

export type { AnalysisInput, AnalysisResult, LLMProvider, ProviderName } from '@/lib/llm/types';

const VALID_PROVIDERS: ProviderName[] = ['anthropic', 'gemini', 'groq', 'deepseek'];
const DEFAULT_PROVIDER: ProviderName = 'groq';

let cachedAnthropic: AnthropicProvider | null = null;
let cachedGemini: GeminiProvider | null = null;
let cachedGroq: GroqProvider | null = null;
let cachedDeepSeek: DeepSeekProvider | null = null;

/**
 * Resolve the active LLM provider from `process.env.LLM_PROVIDER`.
 *
 * Defaults to `groq` because Groq's free developer tier is the most
 * reliable option for local development — Gemini's free keys have been
 * suspending intermittently, and Anthropic burns paid credits. DeepSeek
 * is a cheap paid alternative when Groq's JSON mode misbehaves.
 * Production deployments should set `LLM_PROVIDER=anthropic` explicitly.
 * Providers are lazily instantiated, so a missing API key for the
 * *unused* provider does not crash startup.
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
  if (name === 'gemini') {
    if (!cachedGemini) cachedGemini = new GeminiProvider();
    return cachedGemini;
  }
  if (name === 'deepseek') {
    if (!cachedDeepSeek) cachedDeepSeek = new DeepSeekProvider();
    return cachedDeepSeek;
  }
  if (!cachedGroq) cachedGroq = new GroqProvider();
  return cachedGroq;
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
  if (
    value === 'anthropic' ||
    value === 'gemini' ||
    value === 'groq' ||
    value === 'deepseek'
  ) {
    return value;
  }
  throw new Error(
    `LLM_PROVIDER="${value}" is not supported. Valid values: ${VALID_PROVIDERS.join(' | ')}`
  );
}
