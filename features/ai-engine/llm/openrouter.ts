import OpenAI from 'openai';
import { buildSystemPrompt, buildUserPrompt } from '@features/ai-engine/prompts/pr-analysis';
import {
  normalizeRiskyFiles,
  normalizeVerificationSteps,
  resolveShipDecision,
} from '@features/ai-engine/llm/normalize';
import type {
  AnalysisInput,
  AnalysisResult,
  FocusArea,
  LLMProvider,
  RiskLevel,
} from '@features/ai-engine/llm/types';

type OpenRouterAnalysisJson = {
  summary: string;
  riskLevel: RiskLevel;
  riskFlags: string[];
  focusAreas: FocusArea[];
  shipDecision?: unknown;
  riskyFiles?: unknown;
  verificationSteps?: unknown;
};

/** Primary (paid) model; falls back to the free model when it fails. */
const MODEL = 'deepseek/deepseek-v4-flash';
const FALLBACK_MODEL = 'openai/gpt-oss-120b:free';
const BASE_URL = 'https://openrouter.ai/api/v1';
const TEMPERATURE = 0.1;
// 2000, not the spec's original 1000: the schema output (summary, risky
// files, verification steps) easily passes 1000 tokens on large PRs, and a
// truncated response fails JSON parsing and burns the fallback attempt.
const MAX_TOKENS = 2000;
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * OpenRouter requires these on every request: without them, free-model
 * requests may be rejected and paid-model requests lose attribution.
 */
const OPENROUTER_HEADERS = {
  'HTTP-Referer': 'https://senix.dev',
  'X-Title': 'Senix',
} as const;

// Estimated deepseek/deepseek-v4-flash pricing via OpenRouter (cents per
// 1M tokens). Verify against https://openrouter.ai/models before relying
// on the numbers; the free fallback model costs nothing.
const INPUT_CENTS_PER_MTOK = 14; // ~$0.14 / 1M
const OUTPUT_CENTS_PER_MTOK = 55; // ~$0.55 / 1M

const JSON_SCHEMA_INSTRUCTION = `

You MUST respond with valid JSON matching this exact schema: { "summary": string, "riskLevel": "low" | "medium" | "high", "riskFlags": string[], "focusAreas": Array<{"file": string, "lines": string, "reason": string}>, "shipDecision": "safe to ship" | "ship after checking" | "do not ship until fixed", "riskyFiles": Array<{"file": string, "lineRange": string, "symbol": string, "whatChanged": string, "whyRisky": string, "howToVerify": string, "suggestedFix": string}>, "verificationSteps": string[] }. The "symbol" field inside riskyFiles is optional. Output ONLY the JSON object. No markdown code fences, no preamble, no explanation.`;

/**
 * Strip common preambles (markdown fences, leading/trailing whitespace)
 * and isolate the JSON object. Each provider keeps its own copy of this
 * helper for independence; the helpers may diverge as quirks are observed.
 */
function extractJsonObject(raw: string): string {
  let cleaned = raw.trim();

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error(
      `[openrouter] no JSON object found in response: ${cleaned.slice(0, 200)}`
    );
  }

  return cleaned.slice(firstBrace, lastBrace + 1);
}

/**
 * LLMProvider backed by OpenRouter's OpenAI-compatible chat completions
 * API (https://openrouter.ai/api/v1).
 *
 * Reuses the official `openai` SDK with `baseURL` pointed at OpenRouter,
 * matching the DeepSeek provider's shape. Two models are configured: the
 * paid primary (deepseek/deepseek-v4-flash) is tried first, and any
 * failure retries once on the free fallback (openai/gpt-oss-120b:free)
 * before the provider gives up and lets the cross-provider failover take
 * over. The attribution headers ride on every request via defaultHeaders.
 */
export class OpenRouterProvider implements LLMProvider {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (this.client) return this.client;
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('[openrouter] OPENROUTER_API_KEY must be set to call the OpenRouter API');
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: BASE_URL,
      defaultHeaders: OPENROUTER_HEADERS,
    });
    return this.client;
  }

  /**
   * Send a structural diff to OpenRouter and return a typed behavioral
   * analysis. Throws with an `[openrouter]` prefix on missing key,
   * timeout, or schema-shape violations in the model's JSON output.
   */
  async analyzePR(input: AnalysisInput): Promise<AnalysisResult> {
    const { prMeta, structuralDiff } = input;
    const userPrompt = buildUserPrompt(prMeta, structuralDiff);
    const systemPrompt = buildSystemPrompt() + JSON_SCHEMA_INSTRUCTION;
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    try {
      return await this.callModel(MODEL, messages);
    } catch (primaryErr: unknown) {
      const primaryMessage =
        primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
      // A missing key fails the fallback identically; do not retry on it.
      if (primaryMessage.includes('OPENROUTER_API_KEY')) throw primaryErr;

      console.warn(
        `[openrouter] primary model ${MODEL} failed, retrying on ${FALLBACK_MODEL}: ${primaryMessage}`
      );
      try {
        return await this.callModel(FALLBACK_MODEL, messages);
      } catch (fallbackErr: unknown) {
        const fallbackMessage =
          fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        throw new Error(
          `[openrouter] both models failed. ${MODEL}: ${primaryMessage} | ${FALLBACK_MODEL}: ${fallbackMessage}`
        );
      }
    }
  }

  private async callModel(
    model: string,
    messages: Array<{ role: 'system' | 'user'; content: string }>
  ): Promise<AnalysisResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let responseText: string | null | undefined;
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;
    let totalTokens: number | undefined;
    try {
      const response = await this.getClient().chat.completions.create(
        {
          model,
          temperature: TEMPERATURE,
          max_tokens: MAX_TOKENS,
          response_format: { type: 'json_object' },
          messages,
        },
        { signal: controller.signal }
      );
      responseText = response.choices[0]?.message?.content;
      promptTokens = response.usage?.prompt_tokens;
      completionTokens = response.usage?.completion_tokens;
      totalTokens = response.usage?.total_tokens;
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        throw new Error(`[openrouter] analysis timed out after 60s (model ${model})`);
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`[openrouter] chat.completions.create failed: ${message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!responseText) {
      throw new Error('[openrouter] response contained no message content');
    }

    const cleanedJson = extractJsonObject(responseText);

    let parsed: OpenRouterAnalysisJson;
    try {
      parsed = JSON.parse(cleanedJson) as OpenRouterAnalysisJson;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `[openrouter] failed to parse JSON output: ${message}. Content: ${cleanedJson.slice(0, 300)}`
      );
    }

    if (
      typeof parsed.summary !== 'string' ||
      typeof parsed.riskLevel !== 'string' ||
      !Array.isArray(parsed.riskFlags) ||
      !Array.isArray(parsed.focusAreas)
    ) {
      throw new Error('[openrouter] JSON output was missing required fields');
    }

    const tokensUsed = totalTokens ?? (promptTokens ?? 0) + (completionTokens ?? 0);
    const costUsdCents =
      model === FALLBACK_MODEL
        ? 0
        : computeCostCents(promptTokens ?? 0, completionTokens ?? 0);

    return {
      summary: parsed.summary,
      riskLevel: parsed.riskLevel,
      riskFlags: parsed.riskFlags,
      focusAreas: parsed.focusAreas,
      shipDecision: resolveShipDecision(parsed.shipDecision, parsed.riskLevel),
      riskyFiles: normalizeRiskyFiles(parsed.riskyFiles),
      verificationSteps: normalizeVerificationSteps(parsed.verificationSteps),
      tokensUsed,
      costUsdCents,
      provider: 'openrouter',
    };
  }
}

function computeCostCents(promptTokens: number, completionTokens: number): number {
  const inputCents = (promptTokens / 1_000_000) * INPUT_CENTS_PER_MTOK;
  const outputCents = (completionTokens / 1_000_000) * OUTPUT_CENTS_PER_MTOK;
  return Math.ceil(inputCents + outputCents);
}
