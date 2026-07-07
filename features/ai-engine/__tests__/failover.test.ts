import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AnalysisResult } from '@features/ai-engine/llm/types';

/**
 * Proves: when the primary LLM provider fails, analyzePR automatically
 * retries the next configured provider and still returns a result; and
 * when every provider fails, it throws an aggregated error.
 * Failure means: a single provider outage would block all code reviews.
 */

const { groqAnalyze, anthropicAnalyze, geminiAnalyze, deepseekAnalyze, openrouterAnalyze } =
  vi.hoisted(() => ({
    groqAnalyze: vi.fn(),
    anthropicAnalyze: vi.fn(),
    geminiAnalyze: vi.fn(),
    deepseekAnalyze: vi.fn(),
    openrouterAnalyze: vi.fn(),
  }));

vi.mock('@features/ai-engine/llm/groq', () => ({
  GroqProvider: vi.fn(() => ({ analyzePR: groqAnalyze })),
}));
vi.mock('@features/ai-engine/llm/anthropic', () => ({
  AnthropicProvider: vi.fn(() => ({ analyzePR: anthropicAnalyze })),
}));
vi.mock('@features/ai-engine/llm/gemini', () => ({
  GeminiProvider: vi.fn(() => ({ analyzePR: geminiAnalyze })),
}));
vi.mock('@features/ai-engine/llm/deepseek', () => ({
  DeepSeekProvider: vi.fn(() => ({ analyzePR: deepseekAnalyze })),
}));
vi.mock('@features/ai-engine/llm/openrouter', () => ({
  OpenRouterProvider: vi.fn(() => ({ analyzePR: openrouterAnalyze })),
}));

import { analyzePR, failoverOrder } from '@features/ai-engine/llm';

const input = { prMeta: { title: 't', author: 'a', filesChanged: 1, additions: 1, deletions: 0 }, structuralDiff: [] };

function ok(provider: string): AnalysisResult {
  return {
    summary: 's', riskLevel: 'low', riskFlags: [], focusAreas: [],
    shipDecision: 'safe to ship', riskyFiles: [], verificationSteps: [],
    tokensUsed: 10, costUsdCents: 1, provider: provider as AnalysisResult['provider'],
  };
}

beforeEach(() => {
  for (const k of [
    'ANTHROPIC_API_KEY',
    'GEMINI_API_KEY',
    'GROQ_API_KEY',
    'DEEPSEEK_API_KEY',
    'OPENROUTER_API_KEY',
  ]) {
    delete process.env[k];
  }
  delete process.env.LLM_PROVIDER;
});

describe('analyzePR failover', () => {
  it('uses the primary provider when it succeeds', async () => {
    process.env.LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'k';
    groqAnalyze.mockResolvedValue(ok('groq'));
    const r = await analyzePR(input);
    expect(r.provider).toBe('groq');
    expect(anthropicAnalyze).not.toHaveBeenCalled();
  });

  it('fails over to the next configured provider when the primary throws', async () => {
    process.env.LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'k';
    process.env.ANTHROPIC_API_KEY = 'k';
    groqAnalyze.mockRejectedValue(new Error('groq rate limited'));
    anthropicAnalyze.mockResolvedValue(ok('anthropic'));
    const r = await analyzePR(input);
    expect(r.provider).toBe('anthropic');
    expect(groqAnalyze).toHaveBeenCalledOnce();
  });

  it('skips providers that have no API key configured', () => {
    process.env.LLM_PROVIDER = 'groq';
    process.env.ANTHROPIC_API_KEY = 'k';
    // gemini + deepseek have no key, so they must not appear in the order.
    expect(failoverOrder()).toEqual(['groq', 'anthropic']);
  });

  it('fails over to openrouter when it is the only other configured provider', async () => {
    process.env.LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'k';
    process.env.OPENROUTER_API_KEY = 'k';
    groqAnalyze.mockRejectedValue(new Error('groq down'));
    openrouterAnalyze.mockResolvedValue(ok('openrouter'));
    const r = await analyzePR(input);
    expect(r.provider).toBe('openrouter');
  });

  it('throws an aggregated error when every provider fails', async () => {
    process.env.LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'k';
    process.env.ANTHROPIC_API_KEY = 'k';
    groqAnalyze.mockRejectedValue(new Error('groq down'));
    anthropicAnalyze.mockRejectedValue(new Error('anthropic down'));
    await expect(analyzePR(input)).rejects.toThrow(/All LLM providers failed/);
  });
});
