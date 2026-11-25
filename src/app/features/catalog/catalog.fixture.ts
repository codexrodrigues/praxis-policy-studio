import type { DomainRuleDefinitionAction, DomainRuleTestRun } from '@praxisui/core';
import type { RuleDocumentationDescriptor } from '../../core/rule-documentation';

export type DecisionState = 'technical-draft' | 'verified';

export type DecisionStageId =
  | 'PROTECTED_GUARD'
  | 'DOMAIN_DECISION'
  | 'POST_DECISION'
  | 'TRANSFORMATION_INTENT'
  | 'EFFECT_INTENT';

export type SlotOverridePolicyId =
  | 'FORBIDDEN'
  | 'LOCKED'
  | 'PARAMETERIZABLE'
  | 'REPLACEABLE'
  | 'RESTRICT_ONLY'
  | 'EXTEND_ONLY';

export interface DecisionLegacyOccurrence {
  readonly code: string;
  readonly targetField?: string | null;
  readonly plsqlOrigin?: string | null;
  readonly plsqlLineage?: string | null;
}

export interface DecisionSummary {
  readonly order: number;
  readonly totalDecisions: number;
  readonly key: string;
  readonly code: string;
  readonly name: string;
  readonly domain: string;
  readonly ruleSet: string;
  readonly ruleSetKey: string;
  readonly resourceKey: string | null;
  readonly serviceKey: string | null;
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
  readonly configVersion?: number;
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
  readonly evaluatedFactPaths?: readonly string[];
  readonly facts: readonly DecisionFact[];
  readonly nullSemantics: string | null;
  readonly operationKeys: readonly string[];
  readonly hostContractVersion: string | null;
  readonly evidence: readonly DecisionEvidence[];
  readonly draftLifecycle: string | null;
  readonly ruleType?: string;
  readonly parameters?: Readonly<Record<string, unknown>>;
  readonly parameterCatalog?: DecisionParameterCatalog | null;
  readonly detailHydrated?: boolean;
  readonly slotKey?: string | null;
  readonly decisionStage?: DecisionStageId | null;
  readonly slotOverridePolicy?: SlotOverridePolicyId | null;
  readonly slotCardinality?: string | null;
  readonly availableRoots?: readonly string[];
  readonly conceptRoots?: readonly string[];
  readonly legacyOccurrence?: DecisionLegacyOccurrence | null;
  readonly documentation?: RuleDocumentationDescriptor | null;
  readonly definitionDocumentation?: RuleDocumentationDescriptor | null;
  readonly workspaceDocumentation?: RuleDocumentationDescriptor | null;
  readonly decisionKind?: 'BUSINESS' | 'AUTHORIZATION';
}

export type DecisionParameterValueType = 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN';

export interface DecisionParameterDescriptor {
  readonly name: string;
  readonly label?: string | null;
  readonly description?: string | null;
  readonly type: DecisionParameterValueType;
  readonly required: boolean;
  readonly nullable: boolean;
  readonly readOnly: boolean;
  readonly defaultValue?: unknown;
  readonly declaredValue?: unknown;
  readonly effectiveValue?: unknown;
  readonly minimum?: number | null;
  readonly maximum?: number | null;
  readonly allowedValues?: readonly unknown[];
  readonly unit?: string | null;
  readonly origin?: string | null;
  readonly expressionPointers?: readonly string[];
}

export interface DecisionParameterCatalog {
  readonly definitionId: string;
  readonly ruleKey: string;
  readonly version: number;
  readonly definitionVersion?: number;
  readonly schemaVersion: string;
  readonly templateKey: string | null;
  readonly templateVersion: string | null;
  readonly parameters: readonly DecisionParameterDescriptor[];
}

export interface DecisionFactAllowedValue {
  readonly value: string | number | boolean;
  readonly label: string;
  readonly icon?: string | null;
  readonly tone?: string | null;
  readonly description?: string | null;
}

export interface DecisionFactOptionSourceRef {
  readonly sourceKey: string;
  readonly resourceKey?: string | null;
}

export interface DecisionFactConstraints {
  readonly min?: number | null;
  readonly max?: number | null;
  readonly step?: number | null;
  readonly minLength?: number | null;
  readonly maxLength?: number | null;
  readonly pattern?: string | null;
}

export interface DecisionFactGovernance {
  readonly classification?: string | null;
  readonly dataCategory?: string | null;
  readonly exportable?: boolean | null;
  readonly aiVisibility?: string | null;
  readonly complianceTags?: readonly string[] | null;
}

export interface DecisionFactLineage {
  readonly attributeId?: string | null;
  readonly sourceResourceKey?: string | null;
  readonly transformation?: string | null;
}

export interface DecisionFact {
  readonly path: string;
  readonly valueType: 'boolean' | 'string' | 'number' | 'date' | 'string-array' | 'date-array' | 'number-array' | 'array<number>';
  readonly nullable: boolean;
  readonly label: string;
  readonly description: string;
  readonly providerRef: string;
  readonly evidenceRefs: readonly string[];
  readonly sensitivity: 'NON_SENSITIVE' | 'PERSONAL' | 'SENSITIVE' | 'SECRET';
  readonly redaction: 'NONE' | 'MASK' | 'HASH' | 'OMIT';
  readonly hint?: string | null;
  readonly groupKey?: string | null;
  readonly groupLabel?: string | null;
  readonly unit?: string | null;
  readonly valuePresentation?: string | null;
  readonly mask?: string | null;
  readonly allowedValues?: readonly DecisionFactAllowedValue[] | null;
  readonly optionSourceRef?: DecisionFactOptionSourceRef | null;
  readonly example?: string | null;
  readonly constraints?: DecisionFactConstraints | null;
  readonly governance?: DecisionFactGovernance | null;
  readonly lineage?: DecisionFactLineage | null;
}

export interface DecisionEvidence {
  readonly path: string;
  readonly kind: string;
  readonly sha256?: string | null;
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
  readonly submittedTestRunId: string | null;
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

export type RuleSetCompositionAction = 'PREPARE' | 'APPROVE' | 'PUBLISH';

export interface RuleSetCompositionSource {
  readonly definitionId: string;
  readonly ruleKey: string;
  readonly version: number;
  readonly status?: string | null;
}

export interface RuleSetCompositionCandidate {
  readonly ruleSetKey: string;
  readonly ruleSetVersion: number;
  readonly compositionDigest: string;
  readonly implementationCatalogDigest: string;
  readonly currentHeadEtag: string | null;
  readonly sources: readonly RuleSetCompositionSource[];
  readonly authorizedActions: readonly RuleSetCompositionAction[];
}

export interface RuleSetCompositionCandidateRequest {
  readonly promotedDefinitionId: string;
  readonly validFromUtc: string;
  readonly validUntilUtc?: string | null;
}

export interface RuleSetCompositionCandidateCommand extends RuleSetCompositionCandidateRequest {
  readonly expectedCompositionDigest: string;
}

export interface RuleSetCompositionPublication {
  readonly snapshotKey: string;
  readonly ruleSetKey: string;
  readonly ruleSetVersion: number;
  readonly snapshotContentHash: string;
}
