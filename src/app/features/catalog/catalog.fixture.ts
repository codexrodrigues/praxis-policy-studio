export type DecisionState = 'technical-draft' | 'verified';

export interface DecisionSummary {
  readonly order: number;
  readonly totalDecisions: number;
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
  readonly availableActions?: readonly string[];
  readonly reviewStatus?: string;
  readonly configDefinitionId?: string;
  readonly configStatus?: string;
  readonly expression: string | null;
  readonly condition: unknown | null;
  readonly factPaths: readonly string[];
  readonly facts: readonly DecisionFact[];
  readonly nullSemantics: string | null;
  readonly operationKeys: readonly string[];
  readonly hostContractVersion: string | null;
  readonly evidence: readonly DecisionEvidence[];
  readonly draftLifecycle: string | null;
}

export interface DecisionFact {
  readonly path: string;
  readonly valueType: 'number' | 'date';
  readonly nullable: boolean;
  readonly label: string;
  readonly description: string;
  readonly providerRef: string;
}

export interface DecisionEvidence {
  readonly path: string;
  readonly kind: string;
  readonly sha256: string;
}

export interface DecisionTimelineEvent {
  readonly eventType: string;
  readonly occurredAt: string;
  readonly summary: string;
  readonly status: string | null;
  readonly actor: string | null;
}
