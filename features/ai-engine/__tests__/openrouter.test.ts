import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Proves: the OpenRouter provider returns a correctly shaped analysis,
 * always sends the required attribution headers (HTTP-Referer, X-Title),
 * throws [openrouter]-prefixed errors on a missing key and on HTTP
 * failures, and retries the free fallback model when the paid primary
 * fails (free usage costs zero cents).
 * Failure means: reviews via OpenRouter would break silently, free-model
 * requests would be rejected for missing attribution, or errors would be
 * unattributable in logs.
 */

const { create, constructorOptions } = vi.hoisted(() => ({
  create: vi.fn(),
  constructorOptions: [] as Array<Record<string, unknown>>,
}));

vi.mock('openai', () => ({
  default: vi.fn((options: Record<string, unknown>) => {
    constructorOptions.push(options);
    return { chat: { completions: { create } } };
  }),
}));

import { OpenRouterProvider } from '@features/ai-engine/llm/openrouter';

const input = {
  prMeta: { title: 't', author: 'a', filesChanged: 1, additions: 1, deletions: 0 },
  structuralDiff: [],
};

function okResponse() {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            summary: 'safe change',
            riskLevel: 'low',
            riskFlags: [],
            focusAreas: [],
          }),
        },
      },
    ],
    usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
  };
}

beforeEach(() => {
  create.mockReset();
  constructorOptions.length = 0;
  process.env.OPENROUTER_API_KEY = 'test-key';
});

describe('OpenRouterProvider', () => {
  it('returns a correctly shaped analysis from the primary model', async () => {
    create.mockResolvedValue(okResponse());

    const result = await new OpenRouterProvider().analyzePR(input);

    expect(result.provider).toBe('openrouter');
    expect(result.summary).toBe('safe change');
    expect(result.riskLevel).toBe('low');
    expect(result.shipDecision).toBe('safe to ship');
    expect(result.tokensUsed).toBe(1500);
    expect(result.costUsdCents).toBeGreaterThanOrEqual(1);
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0].model).toBe('deepseek/deepseek-v4-flash');
    expect(create.mock.calls[0][0].response_format).toEqual({ type: 'json_object' });
  });

  it('sends the required attribution headers on every request', async () => {
    create.mockResolvedValue(okResponse());

    await new OpenRouterProvider().analyzePR(input);

    // Headers ride on the client as defaultHeaders, so every request
    // (primary and fallback alike) carries them.
    expect(constructorOptions[0].baseURL).toBe('https://openrouter.ai/api/v1');
    expect(constructorOptions[0].defaultHeaders).toEqual({
      'HTTP-Referer': 'https://senix.dev',
      'X-Title': 'Senix',
    });
  });

  it('throws with the [openrouter] prefix when the API key is missing', async () => {
    delete process.env.OPENROUTER_API_KEY;

    await expect(new OpenRouterProvider().analyzePR(input)).rejects.toThrow(
      /\[openrouter\] OPENROUTER_API_KEY/
    );
    // A missing key must not trigger a pointless fallback attempt.
    expect(create).not.toHaveBeenCalled();
  });

  it('falls back to the free model when the paid primary fails', async () => {
    create
      .mockRejectedValueOnce(new Error('502 upstream error'))
      .mockResolvedValueOnce(okResponse());

    const result = await new OpenRouterProvider().analyzePR(input);

    expect(result.provider).toBe('openrouter');
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].model).toBe('openai/gpt-oss-120b:free');
    // The free fallback model costs nothing.
    expect(result.costUsdCents).toBe(0);
  });

  it('throws with the [openrouter] prefix when both models fail over HTTP', async () => {
    create.mockRejectedValue(new Error('500 internal error'));

    await expect(new OpenRouterProvider().analyzePR(input)).rejects.toThrow(
      /\[openrouter\] both models failed/
    );
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('throws with the [openrouter] prefix on malformed JSON output', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: 'not json at all' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });

    await expect(new OpenRouterProvider().analyzePR(input)).rejects.toThrow(/\[openrouter\]/);
  });
});
