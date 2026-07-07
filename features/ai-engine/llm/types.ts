import type { FileStructuralDiff } from '@features/ai-engine/structural-diff';
import type { PrMeta } from '@features/ai-engine/prompts/pr-analysis';

export type RiskLevel = 'low' | 'medium' | 'high';

export type ProviderName = 'anthropic' | 'gemini' | 'groq' | 'deepseek' | 'openrouter';

export type FocusArea = {
  file: string;
  lines: string;
  reason: string;
};

/**
 * The ship recommendation that accompanies an analysis. The value is
 * picked by the model to match the overall risk level: high risk maps to
 * "do not ship until fixed", medium to "ship after checking", and low to
 * "safe to ship".
 */
export type ShipDecision = 'safe to ship' | 'ship after checking' | 'do not ship until fixed';

/**
 * One file that carries real production risk, described in enough detail
 * that a developer can act on it without re-reading the diff. Pure
 * styling, comment, or documentation changes never produce a RiskyFile.
 */
export type RiskyFile = {
  file: string;
  /** Affected line numbers, e.g. "20-36" for a range or "45" for one line. */
  lineRange: string;
  /** Function, method, or class name involved, when one applies. */
  symbol?: string;
  /** One sentence describing what the code now does. */
  whatChanged: string;
  /** One sentence describing the production impact if this is wrong. */
  whyRisky: string;
  /** A concrete test the developer can run to confirm the problem. */
  howToVerify: string;
  /** The direction of a safe fix or guardrail, not full code. */
  suggestedFix: string;
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
  /** Ship recommendation matched to the overall risk level. */
  shipDecision: ShipDecision;
  /** Files with real production risk. Empty when nothing risky was found. */
  riskyFiles: RiskyFile[];
  /** Up to 5 concrete checks to run before shipping. Empty for trivial changes. */
  verificationSteps: string[];
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
