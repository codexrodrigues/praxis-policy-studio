export type DecisionState = 'technical-draft' | 'verified';

export interface DecisionSummary {
  readonly key: string;
  readonly code: string;
  readonly name: string;
  readonly domain: string;
  readonly ruleSet: string;
  readonly state: DecisionState;
  readonly meaning: string;
  readonly authority: string;
  readonly source: string;
  readonly evidenceCount: number;
  readonly editable?: boolean;
  readonly reviewStatus?: string;
}
