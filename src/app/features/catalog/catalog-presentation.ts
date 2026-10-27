import type {
  DomainRuleExecutionSummary,
  DomainRuleHostStatusSummary,
  DomainRuleSnapshotHeadStatus,
  DomainRuleWorkspaceCapabilities,
  DomainRuleWorkspaceReview
} from '@praxisui/core';
import type {
  DecisionFact,
  DecisionLifecycleSummary,
  DecisionParameterCatalog,
  DecisionSummary,
  RuleSetCompositionCandidate
} from './catalog.fixture';

export type GovernanceGateId =
  | 'SUBMIT'
  | 'REVIEW'
  | 'PROMOTE'
  | 'PUBLISH_DEFINITION'
  | 'OPERATE_SNAPSHOT';

export interface GovernanceGateEntry {
  readonly id: GovernanceGateId;
  readonly allowed: boolean;
  readonly etagBound: boolean;
  readonly etagValue: string | null;
  readonly blockerCodes: readonly string[];
  readonly reviewerRefs: readonly string[];
}

export interface GovernanceGateSummary {
  readonly workspaceStatus: string | null;
  readonly workspaceEtag: string | null;
  readonly promotedDefinitionId: string | null;
  readonly snapshotHeadEtag: string | null;
  readonly submittedTestRunId: string | null;
  readonly evidenceEligibility: string | null;
  readonly receiptBoundToPublication: boolean;
  readonly gates: readonly GovernanceGateEntry[];
}

export interface ExecutionCorrelationSummary {
  readonly activeSnapshotKey: string | null;
  readonly sloPosture: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNOBSERVED';
  readonly totalObservations: number;
  readonly successRatioPercent: number | null;
  readonly errorCount: number;
  readonly alignedHosts: number;
  readonly totalHosts: number;
  readonly boundTestRunId: string | null;
  readonly evidenceEligibility: string | null;
  readonly causalState: 'HEALTHY' | 'ERROR_OBSERVED' | 'UNOBSERVED';
}

export interface DecisionMaturityPosture {
  readonly technicalMaturity: 'STRUCTURAL_VERIFIED' | 'FACT_CATALOG_GAP' | 'DRAFT_STRUCTURE';
  readonly approvalStage: 'PROMOTED_READY' | 'APPROVED' | 'IN_REVIEW' | 'REJECTED' | 'DRAFT_OPEN';
  readonly operationalAuthority: 'CONFIG_ACTIVE_SNAPSHOT' | 'CONFIG_AUTHORITATIVE' | 'LEGACY_AUTHORITATIVE' | 'UNDECLARED';
  readonly activeSnapshotKey: string | null;
  readonly totalFacts: number;
  readonly sensitiveFactsCount: number;
  readonly redactedFactsCount: number;
}

export interface SuggestedDraftDiffProposal {
  readonly id: string;
  readonly kind: 'CONDITION_THRESHOLD' | 'PARAMETER_VALUE';
  readonly label: string;
  readonly summary: string;
  readonly condition: unknown | null;
  readonly parameters: Readonly<Record<string, unknown>> | null;
}

export interface SuggestedScenarioTemplate {
  readonly id: 'ALLOW' | 'DENY';
  readonly scenarioKey: string;
  readonly name: string;
  readonly expectedDecision: 'ALLOW' | 'DENY';
  readonly expectedReasonCodes: readonly string[];
  readonly factValues: Readonly<Record<string, unknown>>;
}

export interface RuleSetPeerDecisionImpact {
  readonly key: string;
  readonly name: string;
  readonly code: string;
  readonly order: number;
  readonly definitionId: string | null;
  readonly version: number;
  readonly role: 'PROMOTED_TARGET' | 'PEER_SLOT';
  readonly sharedFactPaths: readonly string[];
  readonly candidateDefinitionId: string | null;
  readonly candidateVersion: number | null;
  readonly hasUnpromotedDraft: boolean;
  readonly ruleType: string | null;
  readonly nullSemantics: string | null;
  readonly parameterNames: readonly string[];
  readonly operationalEffect: 'BLOCK' | 'ALLOW' | null;
}

export interface RuleSetSharedFactUsage {
  readonly path: string;
  readonly usedByRuleKeys: readonly string[];
}

export interface RuleSetStructuralDiagnostic {
  readonly code: 'DUPLICATE_REASON_CODE' | 'INCONSISTENT_HOST_CONTRACT' | 'UNPROMOTED_PEER_WORKSPACE' | 'MISSING_SLOT_FACTS';
  readonly severity: 'WARNING' | 'ERROR';
  readonly affectedRuleKeys: readonly string[];
  readonly detail: string;
}

export interface RuleSetImpactSummary {
  readonly ruleSetKey: string;
  readonly targetDecisionKey: string | null;
  readonly targetDecisionName: string | null;
  readonly targetDefinitionId: string | null;
  readonly affectedSurfaces: readonly string[];
  readonly affectedOperations: readonly string[];
  readonly hostContractVersions: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly parameterNames: readonly string[];
  readonly sharedFacts: readonly RuleSetSharedFactUsage[];
  readonly peerDecisions: readonly RuleSetPeerDecisionImpact[];
  readonly unpromotedDraftPeers: readonly string[];
  readonly diagnostics: readonly RuleSetStructuralDiagnostic[];
}

export function effectiveDecisionParameters(
  decision: DecisionSummary | null | undefined
): Readonly<Record<string, unknown>> {
  if (!decision) return {};
  const base = decision.parameters ?? {};
  const workspace = decision.workspaceParameters ?? {};
  return Object.keys(workspace).length > 0 ? { ...base, ...workspace } : { ...base };
}

export function hasAllowOperationalEffect(
  parameters: Readonly<Record<string, unknown>> | null | undefined
): boolean {
  if (!parameters) return false;
  return ['validationPolicy', 'availabilityPolicy', 'approvalPolicy'].some(slot => {
    const candidate = parameters[slot];
    return !!candidate
      && typeof candidate === 'object'
      && !Array.isArray(candidate)
      && String((candidate as Record<string, unknown>)['effect'] ?? '').toUpperCase() === 'ALLOW';
  });
}

export function effectiveWorkspaceCondition(
  decision: DecisionSummary | null | undefined
): unknown | null {
  if (!decision) return null;
  if (hasAllowOperationalEffect(effectiveDecisionParameters(decision))) {
    return decision.workspaceCondition ?? null;
  }
  return decision.workspaceCondition ?? decision.condition ?? null;
}

export function hasEditableDecisionParameters(
  decision: DecisionSummary | null | undefined
): boolean {
  if (!decision) return false;
  if ((decision.parameterCatalog?.parameters.length ?? 0) > 0) return true;
  const params = effectiveDecisionParameters(decision);
  return ['validationPolicy', 'availabilityPolicy', 'approvalPolicy'].some(slot => {
    const candidate = params[slot];
    return !!candidate && typeof candidate === 'object' && !Array.isArray(candidate);
  });
}

export function isPublishableSnapshotSource(item: DecisionSummary): boolean {
  if (item.promotedDefinitionId) return true;
  if (!item.configDefinitionId) return false;
  if (!item.configStatus) return item.state === 'verified';
  const normalized = item.configStatus.trim().toLowerCase();
  return normalized === 'approved' || normalized === 'active';
}

export function parseScenarioFactValue(fact: DecisionFact, rawValue: string | boolean): unknown {
  if (fact.valueType === 'boolean') return Boolean(rawValue);
  const text = String(rawValue).trim();
  if (fact.valueType === 'number') return text === '' ? null : Number(text);
  if (fact.valueType === 'number-array' || fact.valueType === 'array<number>') {
    return text.split(/[\n,]/).map(item => item.trim()).filter(Boolean).map(item => Number(item)).filter(item => Number.isFinite(item));
  }
  if (fact.valueType === 'string-array' || fact.valueType === 'date-array') {
    return text.split(/[\n,]/).map(item => item.trim()).filter(Boolean);
  }
  return text;
}

export function valueAtFactPath(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)[segment]
      : undefined, source);
}

export function nestedFactPayload(values: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  Object.entries(values).forEach(([path, value]) => {
    const segments = path.split('.');
    let target = payload;
    segments.forEach((segment, index) => {
      if (index === segments.length - 1) {
        target[segment] = value;
        return;
      }
      const nested = target[segment];
      if (!nested || typeof nested !== 'object' || Array.isArray(nested)) target[segment] = {};
      target = target[segment] as Record<string, unknown>;
    });
  });
  return payload;
}

export function optionalJsonValue(value: string): unknown {
  const normalized = value.trim();
  return normalized ? JSON.parse(normalized) : undefined;
}

export function assertionListFromText(value: string): string[] {
  return [...new Set(value.split(/[\n,]/).map(item => item.trim()).filter(Boolean))];
}

function resolveOperationalEffect(parameters: Readonly<Record<string, unknown>>): 'BLOCK' | 'ALLOW' | null {
  for (const slot of ['validationPolicy', 'availabilityPolicy', 'approvalPolicy']) {
    const candidate = parameters[slot];
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const effect = String((candidate as Record<string, unknown>)['effect'] ?? '').toUpperCase();
      if (effect === 'ALLOW' || effect === 'BLOCK') return effect;
    }
  }
  return null;
}

export function buildRuleSetImpactSummary(
  ruleSetKey: string | null | undefined,
  decisions: readonly DecisionSummary[],
  promotedDefinitionId?: string | null,
  compositionCandidate?: RuleSetCompositionCandidate | null
): RuleSetImpactSummary | null {
  const normalizedRuleSetKey = ruleSetKey?.trim() ?? '';
  if (!normalizedRuleSetKey) return null;
  const ruleSetMembers = decisions.filter(item => item.ruleSetKey === normalizedRuleSetKey);
  if (ruleSetMembers.length === 0) return null;

  const trimmedPromotedId = promotedDefinitionId?.trim() || null;
  const targetDecision = (trimmedPromotedId
    ? ruleSetMembers.find(item =>
        (item.promotedDefinitionId ?? item.configDefinitionId) === trimmedPromotedId
        || item.configDefinitionId === trimmedPromotedId)
    : undefined)
    ?? (compositionCandidate?.sources.length
      ? ruleSetMembers.find(item =>
          compositionCandidate.sources.some(source => source.ruleKey === item.key))
      : undefined)
    ?? ruleSetMembers[0];

  const targetFactPaths = new Set(targetDecision?.factPaths ?? []);
  const affectedSurfaces = [...new Set(
    ruleSetMembers
      .flatMap(item => [item.resourceKey?.trim(), item.serviceKey?.trim()])
      .filter((value): value is string => Boolean(value))
  )];
  const affectedOperations = [...new Set(
    ruleSetMembers
      .flatMap(item => item.operationKeys.map(op => op.trim()))
      .filter(Boolean)
  )];
  const hostContractVersions = [...new Set(
    ruleSetMembers
      .map(item => item.hostContractVersion?.trim())
      .filter((value): value is string => Boolean(value))
  )];
  const reasonCodes = [...new Set(
    ruleSetMembers
      .map(item => item.code?.trim())
      .filter((value): value is string => Boolean(value))
  )];

  const sharedFacts: RuleSetSharedFactUsage[] = (targetDecision?.factPaths ?? [])
    .map(path => {
      const usedByRuleKeys = decisions
        .filter(item => item.key !== targetDecision?.key && item.factPaths.includes(path))
        .map(item => item.key);
      return { path, usedByRuleKeys };
    })
    .filter(entry => entry.usedByRuleKeys.length > 0);

  const peerDecisions: RuleSetPeerDecisionImpact[] = [...ruleSetMembers]
    .sort((left, right) => left.order - right.order)
    .map(member => {
      const effectiveDefinitionId = member.promotedDefinitionId ?? member.configDefinitionId ?? null;
      const isTarget = trimmedPromotedId
        ? effectiveDefinitionId === trimmedPromotedId || member.configDefinitionId === trimmedPromotedId
        : member.key === targetDecision?.key;
      const candidateSource = compositionCandidate?.sources.find(source => source.ruleKey === member.key) ?? null;
      const hasUnpromotedDraft = Boolean(
        member.workspaceId
        && !member.promotedDefinitionId
        && member.workspaceStatus
        && member.workspaceStatus.toUpperCase() !== 'PROMOTED'
      );
      const effectiveParams = effectiveDecisionParameters(member);
      const catalogParamNames = member.parameterCatalog?.parameters.map(param => param.name) ?? [];
      const declaredParamValues = effectiveParams['parameterValues']
        && typeof effectiveParams['parameterValues'] === 'object'
        && !Array.isArray(effectiveParams['parameterValues'])
          ? Object.keys(effectiveParams['parameterValues'] as Record<string, unknown>)
          : [];
      const parameterNames = [...new Set([...catalogParamNames, ...declaredParamValues])];
      return {
        key: member.key,
        name: member.name,
        code: member.code,
        order: member.order,
        definitionId: effectiveDefinitionId,
        version: member.configVersion ?? 1,
        role: isTarget ? 'PROMOTED_TARGET' : 'PEER_SLOT',
        sharedFactPaths: isTarget
          ? member.factPaths
          : member.factPaths.filter(path => targetFactPaths.has(path)),
        candidateDefinitionId: candidateSource?.definitionId ?? null,
        candidateVersion: candidateSource?.version ?? null,
        hasUnpromotedDraft,
        ruleType: member.ruleType ?? null,
        nullSemantics: member.nullSemantics ?? null,
        parameterNames,
        operationalEffect: resolveOperationalEffect(effectiveParams)
      };
    });

  const parameterNames = [...new Set(peerDecisions.flatMap(peer => peer.parameterNames))];
  const unpromotedDraftPeers = peerDecisions
    .filter(peer => peer.hasUnpromotedDraft)
    .map(peer => peer.key);

  const diagnostics: RuleSetStructuralDiagnostic[] = [];
  const membersByReasonCode = new Map<string, string[]>();
  peerDecisions.forEach(peer => {
    const reason = peer.code?.trim();
    if (!reason || reason === peer.key) return;
    const current = membersByReasonCode.get(reason) ?? [];
    current.push(peer.key);
    membersByReasonCode.set(reason, current);
  });
  membersByReasonCode.forEach((ruleKeys, code) => {
    if (ruleKeys.length > 1) {
      diagnostics.push({
        code: 'DUPLICATE_REASON_CODE',
        severity: 'WARNING',
        affectedRuleKeys: ruleKeys,
        detail: `${code} (${ruleKeys.join(', ')})`
      });
    }
  });
  if (hostContractVersions.length > 1) {
    diagnostics.push({
      code: 'INCONSISTENT_HOST_CONTRACT',
      severity: 'ERROR',
      affectedRuleKeys: peerDecisions.map(peer => peer.key),
      detail: hostContractVersions.join(', ')
    });
  }
  if (unpromotedDraftPeers.length > 0) {
    diagnostics.push({
      code: 'UNPROMOTED_PEER_WORKSPACE',
      severity: 'WARNING',
      affectedRuleKeys: unpromotedDraftPeers,
      detail: unpromotedDraftPeers.join(', ')
    });
  }
  const missingFactMembers = ruleSetMembers.filter(member =>
    (member.reviewStatus === 'CATALOG_IDENTITY_ONLY' && member.factPaths.length > 0)
    || (member.facts.length > 0 && member.factPaths.some(path => !member.facts.some(fact => fact.path === path)))
  );
  if (missingFactMembers.length > 0) {
    diagnostics.push({
      code: 'MISSING_SLOT_FACTS',
      severity: 'ERROR',
      affectedRuleKeys: missingFactMembers.map(member => member.key),
      detail: missingFactMembers.map(member => member.key).join(', ')
    });
  }

  return {
    ruleSetKey: normalizedRuleSetKey,
    targetDecisionKey: targetDecision?.key ?? null,
    targetDecisionName: targetDecision?.name ?? null,
    targetDefinitionId: trimmedPromotedId ?? (targetDecision?.promotedDefinitionId ?? targetDecision?.configDefinitionId ?? null),
    affectedSurfaces,
    affectedOperations,
    hostContractVersions,
    reasonCodes,
    parameterNames,
    sharedFacts,
    peerDecisions,
    unpromotedDraftPeers,
    diagnostics
  };
}

interface ConditionFactHint {
  readonly operator: string;
  readonly targetValue: unknown;
}

function resolveParameterReference(
  varPath: string,
  parameters: Readonly<Record<string, unknown>>,
  parameterCatalog?: DecisionParameterCatalog | null
): unknown {
  const prefixMatch = /^(?:parameters|params)\.(.+)$/.exec(varPath);
  const key = prefixMatch ? prefixMatch[1] : varPath;
  if (key in parameters && parameters[key] !== undefined) {
    return parameters[key];
  }
  const catalogMatch = parameterCatalog?.parameters.find(param => param.name === key);
  if (catalogMatch) {
    return catalogMatch.declaredValue ?? catalogMatch.defaultValue;
  }
  return undefined;
}

function extractVarPath(node: unknown): string | null {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return null;
  const entries = Object.entries(node as Record<string, unknown>);
  if (entries.length !== 1 || entries[0][0] !== 'var') return null;
  const raw = entries[0][1];
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === 'string' && raw[0].trim()) return raw[0].trim();
  return null;
}

function collectConditionHints(
  node: unknown,
  parameters: Readonly<Record<string, unknown>>,
  parameterCatalog: DecisionParameterCatalog | null | undefined,
  hints: Map<string, ConditionFactHint>
): void {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return;
  const entries = Object.entries(node as Record<string, unknown>);
  if (entries.length !== 1) return;
  const [operator, rawArgs] = entries[0];
  const args = Array.isArray(rawArgs) ? rawArgs : [rawArgs];

  if (operator === 'and' || operator === 'or' || operator === '!' || operator === 'not') {
    args.forEach(item => collectConditionHints(item, parameters, parameterCatalog, hints));
    return;
  }

  if (args.length >= 2 && ['<=', '<', '>=', '>', '==', '===', '!=', '!==', 'in'].includes(operator)) {
    const leftVar = extractVarPath(args[0]);
    const rightVar = extractVarPath(args[1]);
    if (leftVar && !/^(?:parameters|params)\./.test(leftVar)) {
      const resolvedRight = rightVar
        ? resolveParameterReference(rightVar, parameters, parameterCatalog)
        : args[1];
      if (resolvedRight !== undefined && !hints.has(leftVar)) {
        hints.set(leftVar, { operator, targetValue: resolvedRight });
      }
      return;
    }
  }

  args.forEach(item => collectConditionHints(item, parameters, parameterCatalog, hints));
}

function suggestedFactValue(
  fact: DecisionFact,
  hint: ConditionFactHint | undefined,
  outcome: 'ALLOW' | 'DENY'
): unknown {
  if (hint) {
    const { operator, targetValue } = hint;
    if (fact.valueType === 'number' && typeof targetValue === 'number' && Number.isFinite(targetValue)) {
      if (outcome === 'ALLOW') {
        if (operator === '<') return Math.max(0, targetValue - 1);
        if (operator === '>') return targetValue + 1;
        if (operator === '!=' || operator === '!==') return targetValue + 1;
        return targetValue;
      }
      if (operator === '<=' || operator === '<') return targetValue + 100;
      if (operator === '>=' || operator === '>') return Math.max(0, targetValue - 100);
      if (operator === '==' || operator === '===') return targetValue + 100;
      if (operator === '!=' || operator === '!==') return targetValue;
    }
    if (fact.valueType === 'boolean' && typeof targetValue === 'boolean') {
      const matchesTarget = operator !== '!=' && operator !== '!==';
      return outcome === 'ALLOW'
        ? (matchesTarget ? targetValue : !targetValue)
        : (matchesTarget ? !targetValue : targetValue);
    }
    if (fact.valueType === 'string') {
      if (operator === 'in' && Array.isArray(targetValue) && targetValue.length > 0) {
        return outcome === 'ALLOW' ? String(targetValue[0]) : 'OUTSIDE_ALLOWED_SET';
      }
      if (typeof targetValue === 'string' && targetValue.trim()) {
        const matchesTarget = operator !== '!=' && operator !== '!==';
        return outcome === 'ALLOW'
          ? (matchesTarget ? targetValue : `${targetValue}_ALT`)
          : (matchesTarget ? 'INVALID_VALUE' : targetValue);
      }
    }
  }

  if (fact.valueType === 'number') return outcome === 'ALLOW' ? 100 : 999999;
  if (fact.valueType === 'boolean') return outcome === 'ALLOW';
  if (fact.valueType === 'date') return outcome === 'ALLOW' ? '2026-01-15' : '2099-12-31';
  if (fact.valueType === 'number-array' || fact.valueType === 'array<number>') return outcome === 'ALLOW' ? [100] : [999999];
  if (fact.valueType === 'string-array') return outcome === 'ALLOW' ? ['VALID'] : ['INVALID'];
  if (fact.valueType === 'date-array') return outcome === 'ALLOW' ? ['2026-01-15'] : ['2099-12-31'];
  return outcome === 'ALLOW' ? 'VALID' : 'INVALID';
}

export function buildSuggestedScenarioTemplates(
  decision: DecisionSummary | null | undefined,
  conditionOverride?: unknown
): readonly SuggestedScenarioTemplate[] {
  if (!decision || decision.facts.length === 0) return [];
  const effectiveParams = effectiveDecisionParameters(decision);
  const condition = conditionOverride !== undefined
    ? conditionOverride
    : effectiveWorkspaceCondition(decision);

  const hints = new Map<string, ConditionFactHint>();
  collectConditionHints(condition, effectiveParams, decision.parameterCatalog, hints);

  const rawSlug = decision.key.split('.').pop() || 'scenario';
  const slug = rawSlug.toLowerCase().replace(/[^a-z0-9-_]+/g, '-');
  const codePrefix = decision.code?.trim() || decision.name.trim() || rawSlug;

  const allowFacts: Record<string, unknown> = {};
  const denyFacts: Record<string, unknown> = {};
  decision.facts.forEach(fact => {
    const hint = hints.get(fact.path);
    allowFacts[fact.path] = suggestedFactValue(fact, hint, 'ALLOW');
    denyFacts[fact.path] = suggestedFactValue(fact, hint, 'DENY');
  });

  return [
    {
      id: 'ALLOW',
      scenarioKey: `${slug}-allow`,
      name: `${codePrefix} — ALLOW`,
      expectedDecision: 'ALLOW',
      expectedReasonCodes: [],
      factValues: allowFacts
    },
    {
      id: 'DENY',
      scenarioKey: `${slug}-deny`,
      name: `${codePrefix} — DENY`,
      expectedDecision: 'DENY',
      expectedReasonCodes: decision.code?.trim() ? [decision.code.trim()] : [],
      factValues: denyFacts
    }
  ];
}

export function buildGovernanceGateSummary(
  decision: DecisionSummary | null | undefined,
  capabilities: DomainRuleWorkspaceCapabilities | null | undefined,
  reviews: readonly DomainRuleWorkspaceReview[] = [],
  snapshotHead: DomainRuleSnapshotHeadStatus | null | undefined = null,
  lifecycle: DecisionLifecycleSummary | null | undefined = null
): GovernanceGateSummary | null {
  if (!decision) return null;
  const availableWorkspace = new Set(capabilities?.availableActions ?? []);
  const availableDefinition = new Set(decision.availableDefinitionActions ?? []);
  const blockers = capabilities?.blockers ?? [];
  const workspaceEtag = decision.workspaceEtag?.trim() || null;
  const snapshotHeadEtag = snapshotHead?.headEtag?.trim() || null;
  const submittedTestRunId = lifecycle?.submittedTestRunId?.trim() || null;
  const evidenceEligibility = lifecycle?.latestTestRun?.baselineEvidence?.eligibility ?? null;
  const approvedReviewers = [...new Set(
    reviews
      .filter(review => review.decision?.toUpperCase() === 'APPROVE' && review.reviewerRef?.trim())
      .map(review => review.reviewerRef.trim())
  )];

  const blockersFor = (action: string): readonly string[] =>
    blockers
      .filter(item => item.action?.toUpperCase() === action.toUpperCase())
      .map(item => item.code);

  const gates: readonly GovernanceGateEntry[] = [
    {
      id: 'SUBMIT',
      allowed: availableWorkspace.has('SUBMIT') && Boolean(workspaceEtag),
      etagBound: Boolean(workspaceEtag),
      etagValue: workspaceEtag,
      blockerCodes: blockersFor('SUBMIT'),
      reviewerRefs: []
    },
    {
      id: 'REVIEW',
      allowed: availableWorkspace.has('REVIEW') && Boolean(workspaceEtag),
      etagBound: Boolean(workspaceEtag),
      etagValue: workspaceEtag,
      blockerCodes: blockersFor('REVIEW'),
      reviewerRefs: approvedReviewers
    },
    {
      id: 'PROMOTE',
      allowed: availableWorkspace.has('PROMOTE') && Boolean(workspaceEtag),
      etagBound: Boolean(workspaceEtag),
      etagValue: workspaceEtag,
      blockerCodes: blockersFor('PROMOTE'),
      reviewerRefs: approvedReviewers
    },
    {
      id: 'PUBLISH_DEFINITION',
      allowed: Boolean(decision.promotedDefinitionId) && availableDefinition.has('PUBLISH'),
      etagBound: Boolean(workspaceEtag),
      etagValue: workspaceEtag,
      blockerCodes: blockersFor('PUBLISH'),
      reviewerRefs: approvedReviewers
    },
    {
      id: 'OPERATE_SNAPSHOT',
      allowed: Boolean(snapshotHeadEtag),
      etagBound: Boolean(snapshotHeadEtag),
      etagValue: snapshotHeadEtag,
      blockerCodes: [],
      reviewerRefs: approvedReviewers
    }
  ];

  return {
    workspaceStatus: decision.workspaceStatus ?? null,
    workspaceEtag,
    promotedDefinitionId: decision.promotedDefinitionId ?? null,
    snapshotHeadEtag,
    submittedTestRunId,
    evidenceEligibility,
    receiptBoundToPublication: Boolean(submittedTestRunId && approvedReviewers.length > 0),
    gates
  };
}

export function buildExecutionCorrelationSummary(
  decision: DecisionSummary | null | undefined,
  lifecycle: DecisionLifecycleSummary | null | undefined = null,
  snapshotHead: DomainRuleSnapshotHeadStatus | null | undefined = null,
  executionSummary: DomainRuleExecutionSummary | null | undefined = null,
  hostStatusSummary: DomainRuleHostStatusSummary | null | undefined = null
): ExecutionCorrelationSummary | null {
  if (!decision) return null;
  const activeSnapshotKey = snapshotHead?.activeSnapshotKey?.trim() || null;
  const totalObservations = executionSummary?.totalObservations ?? 0;
  const counts = executionSummary?.outcomeCounts;
  const technicalErrorCount = counts?.TECHNICAL_ERROR ?? 0;
  const inconclusiveCount = counts?.INCONCLUSIVE ?? 0;
  const errorCount = technicalErrorCount + inconclusiveCount;
  const successCount = Math.max(0, totalObservations - errorCount);
  const successRatioPercent = totalObservations > 0
    ? Math.round((successCount / totalObservations) * 100)
    : null;

  const alignedHosts = hostStatusSummary?.alignedHosts ?? 0;
  const totalHosts = hostStatusSummary?.totalHosts ?? 0;
  const incompatibleHosts = hostStatusSummary?.incompatibleHosts ?? 0;
  const driftedHosts = (hostStatusSummary?.snapshotDriftedHosts ?? 0) + (hostStatusSummary?.staleHosts ?? 0);

  let sloPosture: ExecutionCorrelationSummary['sloPosture'] = 'UNOBSERVED';
  if (totalObservations > 0 || totalHosts > 0) {
    if (technicalErrorCount > 0 || incompatibleHosts > 0) {
      sloPosture = 'CRITICAL';
    } else if (inconclusiveCount > 0 || driftedHosts > 0 || (totalHosts > 0 && alignedHosts < totalHosts)) {
      sloPosture = 'DEGRADED';
    } else {
      sloPosture = 'HEALTHY';
    }
  }

  const causalState: ExecutionCorrelationSummary['causalState'] =
    totalObservations === 0
      ? 'UNOBSERVED'
      : errorCount > 0
        ? 'ERROR_OBSERVED'
        : 'HEALTHY';

  return {
    activeSnapshotKey,
    sloPosture,
    totalObservations,
    successRatioPercent,
    errorCount,
    alignedHosts,
    totalHosts,
    boundTestRunId: lifecycle?.submittedTestRunId?.trim() || null,
    evidenceEligibility: lifecycle?.latestTestRun?.baselineEvidence?.eligibility ?? null,
    causalState
  };
}

export function buildDecisionMaturityPosture(
  decision: DecisionSummary | null | undefined,
  snapshotHead: DomainRuleSnapshotHeadStatus | null | undefined = null
): DecisionMaturityPosture | null {
  if (!decision) return null;
  const technicalMaturity: DecisionMaturityPosture['technicalMaturity'] =
    decision.factPaths.some(path => !decision.facts.some(fact => fact.path === path))
      ? 'FACT_CATALOG_GAP'
      : decision.state === 'verified'
        ? 'STRUCTURAL_VERIFIED'
        : 'DRAFT_STRUCTURE';

  const wsStatus = decision.workspaceStatus?.toUpperCase() ?? '';
  const cfgStatus = decision.configStatus?.toUpperCase() ?? '';
  const approvalStage: DecisionMaturityPosture['approvalStage'] =
    decision.promotedDefinitionId || wsStatus === 'PROMOTED'
      ? 'PROMOTED_READY'
      : wsStatus === 'APPROVED' || cfgStatus === 'APPROVED' || cfgStatus === 'ACTIVE'
        ? 'APPROVED'
        : wsStatus === 'SUBMITTED'
          ? 'IN_REVIEW'
          : wsStatus === 'REJECTED'
            ? 'REJECTED'
            : 'DRAFT_OPEN';

  const activeSnapshotKey = snapshotHead?.activeSnapshotKey?.trim() || null;
  const normalizedAuthority = decision.authority.toUpperCase();
  const operationalAuthority: DecisionMaturityPosture['operationalAuthority'] =
    normalizedAuthority.includes('LEGACY_AUTHORITATIVE')
      ? 'LEGACY_AUTHORITATIVE'
      : normalizedAuthority.includes('CONFIG') || normalizedAuthority.includes('GOVERNED_SNAPSHOT')
        ? (activeSnapshotKey ? 'CONFIG_ACTIVE_SNAPSHOT' : 'CONFIG_AUTHORITATIVE')
        : 'UNDECLARED';

  const totalFacts = decision.facts.length;
  const sensitiveFactsCount = decision.facts.filter(fact => fact.sensitivity !== 'NON_SENSITIVE').length;
  const redactedFactsCount = decision.facts.filter(fact => fact.redaction !== 'NONE').length;

  return {
    technicalMaturity,
    approvalStage,
    operationalAuthority,
    activeSnapshotKey,
    totalFacts,
    sensitiveFactsCount,
    redactedFactsCount
  };
}

function replaceFirstNumericComparison(
  node: unknown,
  transform: (currentValue: number, factPath: string, operator: string) => {
    readonly nextValue: number;
    readonly factPath: string;
    readonly operator: string;
    readonly previousValue: number;
  }
): {
  readonly nextNode: unknown;
  readonly changed: {
    readonly factPath: string;
    readonly operator: string;
    readonly previousValue: number;
    readonly nextValue: number;
  } | null;
} {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return { nextNode: node, changed: null };
  }
  const entries = Object.entries(node as Record<string, unknown>);
  if (entries.length !== 1) return { nextNode: node, changed: null };
  const [operator, rawArgs] = entries[0];
  const args = Array.isArray(rawArgs) ? rawArgs : [rawArgs];

  if (args.length === 2 && ['<=', '<', '>=', '>', '==', '==='].includes(operator)) {
    const leftVar = extractVarPath(args[0]);
    const rightVal = args[1];
    if (leftVar && typeof rightVal === 'number' && Number.isFinite(rightVal)) {
      const updated = transform(rightVal, leftVar, operator);
      return {
        nextNode: { [operator]: [args[0], updated.nextValue] },
        changed: updated
      };
    }
  }

  if (Array.isArray(rawArgs)) {
    let foundChange: {
      readonly factPath: string;
      readonly operator: string;
      readonly previousValue: number;
      readonly nextValue: number;
    } | null = null;
    const nextArgs = rawArgs.map(child => {
      if (foundChange) return child;
      const result = replaceFirstNumericComparison(child, transform);
      if (result.changed) {
        foundChange = result.changed;
        return result.nextNode;
      }
      return child;
    });
    if (foundChange) {
      return { nextNode: { [operator]: nextArgs }, changed: foundChange };
    }
  }

  return { nextNode: node, changed: null };
}

export function buildSuggestedDraftDiffProposals(
  decision: DecisionSummary | null | undefined,
  currentCondition?: unknown,
  currentParameters?: Readonly<Record<string, unknown>>
): readonly SuggestedDraftDiffProposal[] {
  if (!decision) return [];
  const proposals: SuggestedDraftDiffProposal[] = [];
  const effectiveParams = currentParameters ?? effectiveDecisionParameters(decision);
  const baseCondition = hasAllowOperationalEffect(effectiveParams)
    ? null
    : currentCondition !== undefined
      ? currentCondition
      : effectiveWorkspaceCondition(decision);

  const relaxResult = replaceFirstNumericComparison(baseCondition, (val, factPath, operator) => {
    const delta = val === 0 ? 10 : Math.max(1, Math.round(Math.abs(val) * 0.1));
    const isLowerBound = operator === '>=' || operator === '>';
    const nextValue = isLowerBound
      ? (val > 0 ? Math.max(0, val - delta) : val - delta)
      : val + delta;
    return { factPath, operator, previousValue: val, nextValue };
  });
  if (relaxResult.changed && relaxResult.changed.nextValue !== relaxResult.changed.previousValue) {
    const signLabel = relaxResult.changed.nextValue > relaxResult.changed.previousValue ? '+10%' : '-10%';
    proposals.push({
      id: 'RELAX_THRESHOLD_10',
      kind: 'CONDITION_THRESHOLD',
      label: `${relaxResult.changed.factPath} ${relaxResult.changed.operator} ${relaxResult.changed.nextValue} (${signLabel})`,
      summary: `${relaxResult.changed.previousValue} → ${relaxResult.changed.nextValue}`,
      condition: relaxResult.nextNode,
      parameters: null
    });
  }

  const tightenResult = replaceFirstNumericComparison(baseCondition, (val, factPath, operator) => {
    const delta = val === 0 ? 1 : Math.max(1, Math.round(Math.abs(val) * 0.1));
    const isLowerBound = operator === '>=' || operator === '>';
    const nextValue = isLowerBound
      ? val + delta
      : (val > 0 ? Math.max(0, val - delta) : val - delta);
    return { factPath, operator, previousValue: val, nextValue };
  });
  if (tightenResult.changed && tightenResult.changed.nextValue !== tightenResult.changed.previousValue) {
    const signLabel = tightenResult.changed.nextValue > tightenResult.changed.previousValue ? '+10%' : '-10%';
    proposals.push({
      id: 'TIGHTEN_THRESHOLD_10',
      kind: 'CONDITION_THRESHOLD',
      label: `${tightenResult.changed.factPath} ${tightenResult.changed.operator} ${tightenResult.changed.nextValue} (${signLabel})`,
      summary: `${tightenResult.changed.previousValue} → ${tightenResult.changed.nextValue}`,
      condition: tightenResult.nextNode,
      parameters: null
    });
  }

  const paramValues = effectiveParams['parameterValues']
    && typeof effectiveParams['parameterValues'] === 'object'
    && !Array.isArray(effectiveParams['parameterValues'])
      ? (effectiveParams['parameterValues'] as Record<string, unknown>)
      : {};

  for (const descriptor of decision.parameterCatalog?.parameters ?? []) {
    if (descriptor.readOnly || (descriptor.type !== 'INTEGER' && descriptor.type !== 'NUMBER')) continue;
    const rawCurrent = paramValues[descriptor.name] ?? descriptor.effectiveValue ?? descriptor.declaredValue ?? descriptor.defaultValue;
    if (typeof rawCurrent !== 'number' || !Number.isFinite(rawCurrent)) continue;
    const step = descriptor.type === 'INTEGER' ? Math.max(1, Math.round(Math.abs(rawCurrent) * 0.1)) : Math.max(1, Number((Math.abs(rawCurrent) * 0.1).toFixed(2)));
    const upperBounded = descriptor.maximum !== null && descriptor.maximum !== undefined
      ? Math.min(descriptor.maximum, rawCurrent + step)
      : rawCurrent + step;
    const candidateVal = descriptor.minimum !== null && descriptor.minimum !== undefined
      ? Math.max(descriptor.minimum, upperBounded)
      : upperBounded;
    if (candidateVal !== rawCurrent) {
      proposals.push({
        id: `PARAM_${descriptor.name}`,
        kind: 'PARAMETER_VALUE',
        label: `${descriptor.label || descriptor.name}: ${rawCurrent} → ${candidateVal}`,
        summary: `$.parameters.parameterValues.${descriptor.name}: ${rawCurrent} → ${candidateVal}`,
        condition: null,
        parameters: {
          ...effectiveParams,
          parameterValues: {
            ...paramValues,
            [descriptor.name]: candidateVal
          }
        }
      });
      break;
    }
  }

  return proposals;
}
