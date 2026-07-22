import { AnthropicProvider } from '@features/ai-engine/llm/anthropic';
import { GeminiProvider } from '@features/ai-engine/llm/gemini';
import { GroqProvider } from '@features/ai-engine/llm/groq';
import { DeepSeekProvider } from '@features/ai-engine/llm/deepseek';
import { OpenRouterProvider } from '@features/ai-engine/llm/openrouter';
import type { AnalysisInput, AnalysisResult, LLMProvider, ProviderName } from '@features/ai-engine/llm/types';

export type { AnalysisInput, AnalysisResult, LLMProvider, ProviderName } from '@features/ai-engine/llm/types';

const VALID_PROVIDERS: ProviderName[] = ['anthropic', 'gemini', 'groq', 'deepseek', 'openrouter'];
const DEFAULT_PROVIDER: ProviderName = 'groq';

/** The env var that must be present for a provider to be usable for failover. */
const PROVIDER_API_KEY_ENV: Record<ProviderName, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

let cachedAnthropic: AnthropicProvider | null = null;
let cachedGemini: GeminiProvider | null = null;
let cachedGroq: GroqProvider | null = null;
let cachedDeepSeek: DeepSeekProvider | null = null;
let cachedOpenRouter: OpenRouterProvider | null = null;

function instantiate(name: ProviderName): LLMProvider {
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
  if (name === 'openrouter') {
    if (!cachedOpenRouter) cachedOpenRouter = new OpenRouterProvider();
    return cachedOpenRouter;
  }
  if (!cachedGroq) cachedGroq = new GroqProvider();
  return cachedGroq;
}

/** Resolve the configured primary provider name. */
export function activeProviderName(): ProviderName {
  const raw = process.env.LLM_PROVIDER?.trim().toLowerCase();
  return raw ? coerceProvider(raw) : DEFAULT_PROVIDER;
}

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
  return instantiate(activeProviderName());
}

/**
 * Build the ordered list of providers to try: the configured primary
 * first, then every other provider that has an API key configured. A
 * provider with no key is skipped so failover never attempts a call that
 * is guaranteed to fail on auth.
 */
export function failoverOrder(): ProviderName[] {
  const primary = activeProviderName();
  const rest = VALID_PROVIDERS.filter(
    (name) => name !== primary && Boolean(process.env[PROVIDER_API_KEY_ENV[name]])
  );
  return [primary, ...rest];
}

/**
 * Run a PR analysis with automatic provider failover.
 *
 * The configured provider is tried first. If it throws (rate limit,
 * timeout, outage, malformed output), the next configured provider is
 * tried, and so on. Only when every available provider fails does this
 * throw, with an aggregated error message. This keeps a single provider
 * outage from blocking reviews.
 */
export async function analyzePR(input: AnalysisInput): Promise<AnalysisResult> {
  const order = failoverOrder();
  const errors: string[] = [];

  for (const name of order) {
    try {
      return await instantiate(name).analyzePR(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${name}: ${message}`);
      console.warn(`[llm] provider ${name} failed, trying next: ${message}`);
    }
  }

  throw new Error(`All LLM providers failed. ${errors.join(' | ')}`);
}

function coerceProvider(value: string): ProviderName {
  if (
    value === 'anthropic' ||
    value === 'gemini' ||
    value === 'groq' ||
    value === 'deepseek' ||
    value === 'openrouter'
  ) {
    return value;
  }
  throw new Error(
    `LLM_PROVIDER="${value}" is not supported. Valid values: ${VALID_PROVIDERS.join(' | ')}`
  );
}
