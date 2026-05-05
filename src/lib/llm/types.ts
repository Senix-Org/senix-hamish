import type { FileStructuralDiff } from '@/lib/structural-diff';
import type { PrMeta } from '@/lib/prompts/pr-analysis';

export type RiskLevel = 'low' | 'medium' | 'high';

export type ProviderName = 'anthropic' | 'gemini' | 'groq' | 'deepseek';

export type FocusArea = {
  file: string;
  lines: string;
  reason: string;
};

export type AnalysisInput = {
  prMeta: PrMeta;
  structuralDiff: FileStructuralDiff[];
};

export type AnalysisResult = {
  summary: string;
  riskLevel: RiskLevel;
  riskFlags: string[];
  focusAreas: FocusArea[];
  tokensUsed: number;
  costUsdCents: number;
  provider: ProviderName;
};

/**
 * Provider-agnostic LLM analysis interface. Each implementation owns its
 * own SDK, model, prompt-format, and cost calculation, but produces the
 * same `AnalysisResult` shape so consumers can swap providers freely.
 */
export interface LLMProvider {
  analyzePR(input: AnalysisInput): Promise<AnalysisResult>;
}
