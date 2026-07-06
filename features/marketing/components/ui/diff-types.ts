export type RiskLevel = 'low' | 'medium' | 'high';

export type DiffLine = {
  type: 'add' | 'remove' | 'context' | 'hunk';
  content: string;
  lineNumber?: number;
};

export type AICommentData = {
  lineIndex: number;
  risk: RiskLevel;
  title: string;
  body: string;
  tags?: string[];
};

export const SAMPLE_DIFF_LINES: DiffLine[] = [
  { type: 'hunk', content: '@@ -10,6 +10,14 @@ export class UserService {' },
  { type: 'context', content: '  async fetchUser(id: string) {', lineNumber: 10 },
  { type: 'remove', content: '-    return fetch(`/api/users/${id}`);', lineNumber: 11 },
  {
    type: 'add',
    content: '+    const token = process.env.API_TOKEN;',
    lineNumber: 11,
  },
  {
    type: 'add',
    content: '+    return fetch(`/api/users/${id}`, {',
    lineNumber: 12,
  },
  { type: 'add', content: '+      headers: { Authorization: `Bearer ${token}` },', lineNumber: 13 },
  { type: 'add', content: '+    });', lineNumber: 14 },
  { type: 'context', content: '  }', lineNumber: 15 },
];

export const SAMPLE_AI_COMMENT: AICommentData = {
  lineIndex: 3,
  risk: 'high',
  title: 'Hardcoded secret detected',
  body: 'A live API token is embedded in source. Rotate immediately and load from env.',
  tags: ['hardcoded-secret', 'auth-change'],
};

const RISK_STYLES: Record<RiskLevel, string> = {
  low: 'bg-green-500/15 text-green-400 border-green-500/30',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  high: 'bg-red-500/15 text-red-400 border-red-500/30',
};

export function riskBadgeClass(risk: RiskLevel): string {
  return RISK_STYLES[risk];
}

export function riskLabel(risk: RiskLevel): string {
  return risk.charAt(0).toUpperCase() + risk.slice(1);
}
