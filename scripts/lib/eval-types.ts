import type { FileStructuralDiff } from '../../src/lib/structural-diff';
import type { AnalysisResult } from '../../src/lib/llm/types';
import type { PrMeta } from '../../src/lib/prompts/pr-analysis';

export type ExpectedRiskLevel = 'low' | 'medium' | 'high';

export type EvalCase = {
  id: string;
  description: string;
  expectedRiskLevel: ExpectedRiskLevel;
  expectedFlags: string[];
  prMeta: PrMeta;
  structuralDiff: FileStructuralDiff[];
};

export type ScoreValue = 1 | 2 | 3;

export type EvalScore = {
  caseId: string;
  accuracy: ScoreValue;
  specificity: ScoreValue;
  riskCalibration: ScoreValue;
  conciseness: ScoreValue;
  notes: string;
};

export type EvalResult = {
  case: EvalCase;
  output: AnalysisResult | null;
  score: EvalScore | null;
  durationMs: number;
  error: string | null;
};

export type EvalRun = {
  promptVersion: string;
  provider: string;
  model: string;
  startedAt: string;
  totalCases: number;
  results: EvalResult[];
  totalScore: number | null;
  maxScore: number;
};

export const SCORE_DIMENSIONS = [
  'accuracy',
  'specificity',
  'riskCalibration',
  'conciseness',
] as const;

export const MAX_DIMENSION_SCORE = 3;
export const DIMENSIONS_PER_CASE = SCORE_DIMENSIONS.length;
export const MAX_SCORE_PER_CASE = MAX_DIMENSION_SCORE * DIMENSIONS_PER_CASE;

/**
 * Sum the four dimension scores for a single case.
 */
export function sumCaseScore(score: EvalScore): number {
  return score.accuracy + score.specificity + score.riskCalibration + score.conciseness;
}
