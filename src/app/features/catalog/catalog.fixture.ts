import type { DomainRuleDefinitionAction, DomainRuleTestRun } from '@praxisui/core';

export type DecisionState = 'technical-draft' | 'verified';

export interface DecisionSummary {
  readonly order: number;
  readonly totalDecisions: number;
  readonly key: string;
  readonly code: string;
  readonly name: string;
  readonly domain: string;
  readonly ruleSet: string;
  readonly ruleSetKey: string;
  readonly state: DecisionState;
  readonly meaning: string;
  readonly authority: string;
  readonly baselineAuthority: string;
  readonly source: string;
  readonly evidenceCount: number;
  readonly authoringSupported: boolean;
  readonly availableDefinitionActions: readonly DomainRuleDefinitionAction[];
  readonly reviewStatus?: string;
  readonly configDefinitionId?: string;
  readonly configStatus?: string;
  readonly workspaceId?: string;
  readonly workspaceStatus?: string;
  readonly workspaceEtag?: string;
  readonly workspaceRevision?: number;
  readonly promotedDefinitionId?: string | null;
  readonly workspaceCondition?: unknown | null;
  readonly workspaceParameters?: Readonly<Record<string, unknown>>;
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
  readonly valueType: 'boolean' | 'string' | 'number' | 'date' | 'string-array' | 'date-array';
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

export interface DecisionLifecycleSummary {
  readonly workspaceStatus: string;
  readonly workspaceRevision: number;
  readonly testRunCount: number;
  readonly reviewCount: number;
  readonly materializationCount: number;
  readonly promotedDefinitionId: string | null;
  readonly latestTestRun: DomainRuleTestRun | null;
}

export interface PolicySandboxScenarioResult {
  readonly scenarioId: string;
  readonly scenarioKey: string;
  readonly expectedDecision: string;
  readonly candidateDecision: string;
  readonly activeDecision: string;
  readonly comparison: string;
  readonly candidateMatchesExpected: boolean;
  readonly activeMatchesExpected: boolean;
  readonly candidateReasonCodes: readonly string[];
  readonly activeReasonCodes: readonly string[];
}

export interface PolicySandboxRun {
  readonly runId: string;
  readonly workspaceId: string;
  readonly workspaceRevision: number;
  readonly evaluatedAtUtc: string;
  readonly activeSnapshotKey: string | null;
  readonly results: readonly PolicySandboxScenarioResult[];
}

export interface PublicationReadiness {
  readonly result: string | null;
  readonly readiness: string | null;
  readonly existingCoverage: readonly unknown[];
  readonly predictedMaterializations: readonly unknown[];
  readonly requiredApprovals: readonly unknown[];
  readonly warnings: readonly unknown[];
  readonly recommendedAction: string | null;
}

export interface DecisionPublicationResult {
  readonly status: string | null;
  readonly readiness: string | null;
  readonly materializationCount: number;
  readonly outcomes: readonly unknown[];
}
