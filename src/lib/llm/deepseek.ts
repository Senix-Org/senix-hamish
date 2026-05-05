import OpenAI from 'openai';
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompts/pr-analysis';
import type {
  AnalysisInput,
  AnalysisResult,
  FocusArea,
  LLMProvider,
  RiskLevel,
} from '@/lib/llm/types';

type DeepSeekAnalysisJson = {
  summary: string;
  riskLevel: RiskLevel;
  riskFlags: string[];
  focusAreas: FocusArea[];
};

const MODEL = 'deepseek-v4-pro';
const BASE_URL = 'https://api.deepseek.com';
const TEMPERATURE = 0;
const REQUEST_TIMEOUT_MS = 60_000;

// DeepSeek pricing (cents per 1M tokens) — input is cache-miss rate
const INPUT_CENTS_PER_MTOK = 27; // $0.27 / 1M
const OUTPUT_CENTS_PER_MTOK = 110; // $1.10 / 1M

const JSON_SCHEMA_INSTRUCTION = `

You MUST respond with valid JSON matching this exact schema: { "summary": string, "riskLevel": "low" | "medium" | "high", "riskFlags": string[], "focusAreas": Array<{"file": string, "lines": string, "reason": string}> }. Output ONLY the JSON object. No markdown code fences, no preamble, no explanation.`;

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
      `[deepseek] no JSON object found in response: ${cleaned.slice(0, 200)}`
    );
  }

  return cleaned.slice(firstBrace, lastBrace + 1);
}

/**
 * LLMProvider backed by DeepSeek's OpenAI-compatible chat completions API.
 *
 * Reuses the official `openai` SDK with `baseURL` pointed at DeepSeek so
 * the call shape matches Groq's. Uses JSON-object response mode and a
 * schema instruction appended to the system prompt. DeepSeek is paid but
 * cheap, so cost is calculated from `usage.prompt_tokens` /
 * `usage.completion_tokens` and reported in integer USD cents.
 */
export class DeepSeekProvider implements LLMProvider {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (this.client) return this.client;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('[deepseek] DEEPSEEK_API_KEY must be set to call the DeepSeek API');
    }
    this.client = new OpenAI({ apiKey, baseURL: BASE_URL });
    return this.client;
  }

  /**
   * Send a structural diff to DeepSeek and return a typed behavioral
   * analysis. Throws with a `[deepseek]` prefix on missing key, timeout,
   * or schema-shape violations in the model's JSON output.
   */
  async analyzePR(input: AnalysisInput): Promise<AnalysisResult> {
    const { prMeta, structuralDiff } = input;
    const userPrompt = buildUserPrompt(prMeta, structuralDiff);
    const systemPrompt = buildSystemPrompt() + JSON_SCHEMA_INSTRUCTION;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let responseText: string | null | undefined;
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;
    let totalTokens: number | undefined;
    try {
      const response = await this.getClient().chat.completions.create(
        {
          model: MODEL,
          temperature: TEMPERATURE,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        },
        { signal: controller.signal }
      );
      responseText = response.choices[0]?.message?.content;
      promptTokens = response.usage?.prompt_tokens;
      completionTokens = response.usage?.completion_tokens;
      totalTokens = response.usage?.total_tokens;
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        throw new Error('DeepSeek analysis timed out after 60s');
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`[deepseek] chat.completions.create failed: ${message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!responseText) {
      throw new Error('[deepseek] response contained no message content');
    }

    const cleanedJson = extractJsonObject(responseText);

    let parsed: DeepSeekAnalysisJson;
    try {
      parsed = JSON.parse(cleanedJson) as DeepSeekAnalysisJson;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `[deepseek] failed to parse JSON output: ${message}. Content: ${cleanedJson.slice(0, 300)}`
      );
    }

    if (
      typeof parsed.summary !== 'string' ||
      typeof parsed.riskLevel !== 'string' ||
      !Array.isArray(parsed.riskFlags) ||
      !Array.isArray(parsed.focusAreas)
    ) {
      throw new Error('[deepseek] JSON output was missing required fields');
    }

    const tokensUsed = totalTokens ?? (promptTokens ?? 0) + (completionTokens ?? 0);
    const costUsdCents = computeCostCents(promptTokens ?? 0, completionTokens ?? 0);

    return {
      summary: parsed.summary,
      riskLevel: parsed.riskLevel,
      riskFlags: parsed.riskFlags,
      focusAreas: parsed.focusAreas,
      tokensUsed,
      costUsdCents,
      provider: 'deepseek',
    };
  }
}

function computeCostCents(promptTokens: number, completionTokens: number): number {
  const inputCents = (promptTokens / 1_000_000) * INPUT_CENTS_PER_MTOK;
  const outputCents = (completionTokens / 1_000_000) * OUTPUT_CENTS_PER_MTOK;
  return Math.ceil(inputCents + outputCents);
}
