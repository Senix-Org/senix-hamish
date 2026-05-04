import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompts/pr-analysis';
import type {
  AnalysisInput,
  AnalysisResult,
  FocusArea,
  LLMProvider,
  RiskLevel,
} from '@/lib/llm/types';

type GeminiAnalysisJson = {
  summary: string;
  risk_level: RiskLevel;
  risk_flags: string[];
  focus_areas: FocusArea[];
};

const MODEL = 'gemini-2.5-flash-lite';
const TEMPERATURE = 0;
const REQUEST_TIMEOUT_MS = 60_000;
const CHARS_PER_TOKEN_ESTIMATE = 4;

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: 'Exactly 3 sentences describing the behavioral change.',
    },
    risk_level: {
      type: Type.STRING,
      enum: ['low', 'medium', 'high'],
      description: 'Production-impact risk level, not diff size.',
    },
    risk_flags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Short kebab-case risk labels that apply to this PR.',
    },
    focus_areas: {
      type: Type.ARRAY,
      maxItems: '3',
      items: {
        type: Type.OBJECT,
        properties: {
          file: { type: Type.STRING },
          lines: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ['file', 'lines', 'reason'],
      },
      description: 'Up to 3 file/line ranges that deserve reviewer attention.',
    },
  },
  required: ['summary', 'risk_level', 'risk_flags', 'focus_areas'],
};

/**
 * LLMProvider backed by Google's Gemini API via the @google/genai SDK.
 *
 * Uses structured-output mode (`responseMimeType: 'application/json'` plus
 * a `responseSchema`) to guarantee JSON output. Cost is reported as 0
 * because the Gemini free tier is the intended target during development.
 */
export class GeminiProvider implements LLMProvider {
  private client: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    if (this.client) return this.client;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('[gemini] GEMINI_API_KEY must be set to call the Gemini API');
    }
    this.client = new GoogleGenAI({ apiKey });
    return this.client;
  }

  /**
   * Send a structural diff to Gemini and return a typed behavioral analysis.
   * Throws with a `[gemini]` prefix on missing key, timeout, or schema-shape
   * violations in the model's JSON output.
   */
  async analyzePR(input: AnalysisInput): Promise<AnalysisResult> {
    const { prMeta, structuralDiff } = input;
    const userPrompt = buildUserPrompt(prMeta, structuralDiff);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let responseText: string | undefined;
    let usage: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined;
    try {
      const response = await this.getClient().models.generateContent({
        model: MODEL,
        contents: userPrompt,
        config: {
          systemInstruction: buildSystemPrompt(),
          temperature: TEMPERATURE,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          abortSignal: controller.signal,
        },
      });
      responseText = response.text;
      usage = response.usageMetadata;
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        throw new Error('Gemini analysis timed out after 60s');
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`[gemini] generateContent failed: ${message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!responseText) {
      throw new Error('[gemini] response contained no text content');
    }

    let parsed: GeminiAnalysisJson;
    try {
      parsed = JSON.parse(responseText) as GeminiAnalysisJson;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`[gemini] failed to parse JSON output: ${message}`);
    }

    if (
      typeof parsed.summary !== 'string' ||
      typeof parsed.risk_level !== 'string' ||
      !Array.isArray(parsed.risk_flags) ||
      !Array.isArray(parsed.focus_areas)
    ) {
      throw new Error('[gemini] JSON output was missing required fields');
    }

    const promptTokens = usage?.promptTokenCount;
    const candidateTokens = usage?.candidatesTokenCount;
    const tokensUsed =
      typeof promptTokens === 'number' && typeof candidateTokens === 'number'
        ? promptTokens + candidateTokens
        : Math.ceil((userPrompt.length + responseText.length) / CHARS_PER_TOKEN_ESTIMATE);

    return {
      summary: parsed.summary,
      riskLevel: parsed.risk_level,
      riskFlags: parsed.risk_flags,
      focusAreas: parsed.focus_areas,
      tokensUsed,
      costUsdCents: 0,
      provider: 'gemini',
    };
  }
}
