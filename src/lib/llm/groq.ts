import Groq from 'groq-sdk';
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompts/pr-analysis';
import type {
  AnalysisInput,
  AnalysisResult,
  FocusArea,
  LLMProvider,
  RiskLevel,
} from '@/lib/llm/types';

type GroqAnalysisJson = {
  summary: string;
  riskLevel: RiskLevel;
  riskFlags: string[];
  focusAreas: FocusArea[];
};

const MODEL = 'openai/gpt-oss-120b';
const TEMPERATURE = 0;
const REQUEST_TIMEOUT_MS = 60_000;
const CHARS_PER_TOKEN_ESTIMATE = 4;

const JSON_SCHEMA_INSTRUCTION = `

You MUST respond with a JSON object matching exactly this schema: { "summary": string, "riskLevel": "low" | "medium" | "high", "riskFlags": string[], "focusAreas": Array<{"file": string, "lines": string, "reason": string}> }. No markdown, no preamble, just the JSON.`;

/**
 * Strip common preambles (markdown fences, leading/trailing whitespace)
 * and isolate the JSON object. Groq's strict json_object mode sometimes
 * rejects responses with surrounding whitespace or fence markers, so we
 * defensively clean before parsing.
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
      `[groq] no JSON object found in response: ${cleaned.slice(0, 200)}`
    );
  }

  return cleaned.slice(firstBrace, lastBrace + 1);
}

/**
 * LLMProvider backed by Groq's OpenAI-compatible chat completions API.
 *
 * Uses `response_format: { type: 'json_object' }` for guaranteed JSON
 * output and appends an explicit schema instruction to the system prompt
 * so the model knows the exact field shape. Groq's developer tier is
 * free, so cost is reported as 0.
 */
export class GroqProvider implements LLMProvider {
  private client: Groq | null = null;

  private getClient(): Groq {
    if (this.client) return this.client;
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('[groq] GROQ_API_KEY must be set to call the Groq API');
    }
    this.client = new Groq({ apiKey });
    return this.client;
  }

  /**
   * Send a structural diff to a Groq-hosted model and return a typed
   * behavioral analysis. Throws with a `[groq]` prefix on missing key,
   * timeout, or schema-shape violations in the model's JSON output.
   */
  async analyzePR(input: AnalysisInput): Promise<AnalysisResult> {
    const { prMeta, structuralDiff } = input;
    const userPrompt = buildUserPrompt(prMeta, structuralDiff);
    const systemPrompt = buildSystemPrompt() + JSON_SCHEMA_INSTRUCTION;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let responseText: string | null | undefined;
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
      totalTokens = response.usage?.total_tokens;
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        throw new Error('Groq analysis timed out after 60s');
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`[groq] chat.completions.create failed: ${message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!responseText) {
      throw new Error('[groq] response contained no message content');
    }

    const cleanedJson = extractJsonObject(responseText);

    let parsed: GroqAnalysisJson;
    try {
      parsed = JSON.parse(cleanedJson) as GroqAnalysisJson;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `[groq] failed to parse JSON output: ${message}. Content: ${cleanedJson.slice(0, 300)}`
      );
    }

    if (
      typeof parsed.summary !== 'string' ||
      typeof parsed.riskLevel !== 'string' ||
      !Array.isArray(parsed.riskFlags) ||
      !Array.isArray(parsed.focusAreas)
    ) {
      throw new Error('[groq] JSON output was missing required fields');
    }

    const tokensUsed =
      typeof totalTokens === 'number'
        ? totalTokens
        : Math.ceil(
            (systemPrompt.length + userPrompt.length + responseText.length) /
              CHARS_PER_TOKEN_ESTIMATE
          );

    return {
      summary: parsed.summary,
      riskLevel: parsed.riskLevel,
      riskFlags: parsed.riskFlags,
      focusAreas: parsed.focusAreas,
      tokensUsed,
      costUsdCents: 0,
      provider: 'groq',
    };
  }
}