import type { DecisionSummary } from '../features/catalog/catalog.fixture';
import { humanizeRuleType, humanizeTechnicalSlug, looksLikeTechnicalSlug } from './humanize-labels';
import type { SupportedLocale } from './runtime-config';
import type { StudioViewDepth } from './studio-shell-state.service';

export type ExplorerGlobalLens = 'domain' | 'type' | 'workflow';

export type ExplorerAutonomyFilter = 'all' | 'param' | 'editable' | 'locked' | 'legal';

export type WorkflowBucketId = 'SUBMITTED' | 'OPEN' | 'REJECTED' | 'APPROVED' | 'STABLE';

export interface PortfolioFunctionalityItem {
  readonly scopeKey: string;
  readonly label: string;
  readonly count: number;
  readonly activeWorkCount: number;
}

export interface PortfolioDomainCard {
  readonly domainKey: string;
  readonly label: string;
  readonly totalCount: number;
  readonly activeWorkCount: number;
  readonly functionalities: readonly PortfolioFunctionalityItem[];
}

export interface PortfolioRuleTypeSummary {
  readonly ruleType: string;
  readonly label: string;
  readonly count: number;
  readonly percentage: number;
}

export interface CatalogPortfolioSummary {
  readonly totalRules: number;
  readonly domainCount: number;
  readonly functionalityCount: number;
  readonly activeWorkflowDecisions: readonly DecisionSummary[];
  readonly domains: readonly PortfolioDomainCard[];
  readonly ruleTypes: readonly PortfolioRuleTypeSummary[];
}

const RELIABILITY_THRESHOLD = 0.75;

const WORKFLOW_BUCKET_PRIORITY: Readonly<Record<WorkflowBucketId, number>> = {
  SUBMITTED: 0,
  OPEN: 1,
  REJECTED: 2,
  APPROVED: 3,
  STABLE: 4
};

/**
 * Returns true only when enough decisions in the active view carry `decisionStage`
 * so stage grouping never dumps unhydrated rules into "Other decisions".
 */
export function isStageGroupingReliable(decisions: readonly DecisionSummary[]): boolean {
  if (decisions.length === 0) {
    return false;
  }
  let hydratedStages = 0;
  for (const item of decisions) {
    if (item.decisionStage) {
      hydratedStages += 1;
    }
  }
  return hydratedStages / decisions.length >= RELIABILITY_THRESHOLD;
}

/**
 * Returns true only when enough decisions in the active view carry `slotOverridePolicy`
 * so autonomy filters accurately reflect every rule in scope.
 */
export function isAutonomyFilterReliable(decisions: readonly DecisionSummary[]): boolean {
  if (decisions.length === 0) {
    return false;
  }
  let hydratedPolicies = 0;
  for (const item of decisions) {
    if (item.slotOverridePolicy) {
      hydratedPolicies += 1;
    }
  }
  return hydratedPolicies / decisions.length >= RELIABILITY_THRESHOLD;
}

export function classifyDecisionWorkflowBucket(decision: DecisionSummary): WorkflowBucketId {
  const status = decision.workspaceStatus?.toUpperCase();
  switch (status) {
    case 'SUBMITTED':
      return 'SUBMITTED';
    case 'OPEN':
      return 'OPEN';
    case 'REJECTED':
      return 'REJECTED';
    case 'APPROVED':
      return 'APPROVED';
    default:
      return 'STABLE';
  }
}

function formatPortfolioLabel(
  raw: string,
  locale: SupportedLocale,
  viewDepth: StudioViewDepth,
  maxSegments?: number
): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  if (viewDepth === 'technical' || !looksLikeTechnicalSlug(trimmed)) {
    return trimmed;
  }
  return humanizeTechnicalSlug(trimmed, maxSegments, locale) || trimmed;
}

function resolveFunctionalityScopeKey(decision: DecisionSummary): string {
  return (
    decision.ruleSetKey?.trim() ||
    decision.resourceKey?.trim() ||
    decision.domain?.trim() ||
    'catalog'
  );
}

function resolveFunctionalityRawName(decision: DecisionSummary): string {
  return (
    decision.ruleSet?.trim() ||
    decision.resourceKey?.trim() ||
    decision.ruleSetKey?.trim() ||
    decision.domain?.trim() ||
    'Catalog'
  );
}

/**
 * Aggregates global catalog-level dimensions guaranteed to exist across hydrated and
 * unhydrated decisions (`domain`, `ruleSetKey`/`resourceKey`, `ruleType`, and `workspaceStatus`).
 */
export function buildCatalogPortfolioSummary(
  decisions: readonly DecisionSummary[],
  locale: SupportedLocale,
  viewDepth: StudioViewDepth
): CatalogPortfolioSummary {
  const activeWorkflowDecisions: DecisionSummary[] = [];
  const functionalityKeys = new Set<string>();
  const domainMap = new Map<
    string,
    {
      domainKey: string;
      totalCount: number;
      activeWorkCount: number;
      functionalities: Map<string, { scopeKey: string; rawLabel: string; count: number; activeWorkCount: number }>;
    }
  >();
  const typeMap = new Map<string, number>();

  for (const item of decisions) {
    const bucket = classifyDecisionWorkflowBucket(item);
    const isActiveWork = bucket !== 'STABLE';
    if (isActiveWork) {
      activeWorkflowDecisions.push(item);
    }

    const domainKey = item.domain?.trim() || 'domain-decisions';
    let domainEntry = domainMap.get(domainKey);
    if (!domainEntry) {
      domainEntry = {
        domainKey,
        totalCount: 0,
        activeWorkCount: 0,
        functionalities: new Map()
      };
      domainMap.set(domainKey, domainEntry);
    }
    domainEntry.totalCount += 1;
    if (isActiveWork) {
      domainEntry.activeWorkCount += 1;
    }

    const funcKey = resolveFunctionalityScopeKey(item);
    functionalityKeys.add(funcKey);
    let funcEntry = domainEntry.functionalities.get(funcKey);
    if (!funcEntry) {
      funcEntry = {
        scopeKey: funcKey,
        rawLabel: resolveFunctionalityRawName(item),
        count: 0,
        activeWorkCount: 0
      };
      domainEntry.functionalities.set(funcKey, funcEntry);
    }
    funcEntry.count += 1;
    if (isActiveWork) {
      funcEntry.activeWorkCount += 1;
    }

    const normalizedType = item.ruleType?.trim() || 'other';
    typeMap.set(normalizedType, (typeMap.get(normalizedType) ?? 0) + 1);
  }

  activeWorkflowDecisions.sort((left, right) => {
    const priorityDiff =
      WORKFLOW_BUCKET_PRIORITY[classifyDecisionWorkflowBucket(left)] -
      WORKFLOW_BUCKET_PRIORITY[classifyDecisionWorkflowBucket(right)];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return left.name.localeCompare(right.name);
  });

  const domains: PortfolioDomainCard[] = [...domainMap.values()]
    .map((entry) => ({
      domainKey: entry.domainKey,
      label: formatPortfolioLabel(entry.domainKey, locale, viewDepth, 2) || entry.domainKey,
      totalCount: entry.totalCount,
      activeWorkCount: entry.activeWorkCount,
      functionalities: [...entry.functionalities.values()]
        .map((func) => ({
          scopeKey: func.scopeKey,
          label: formatPortfolioLabel(func.rawLabel, locale, viewDepth, 2) || func.scopeKey,
          count: func.count,
          activeWorkCount: func.activeWorkCount
        }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    }))
    .sort((a, b) => b.totalCount - a.totalCount || a.label.localeCompare(b.label));

  const totalRules = decisions.length;
  const ruleTypes: PortfolioRuleTypeSummary[] = [...typeMap.entries()]
    .map(([ruleType, count]) => ({
      ruleType,
      label: humanizeRuleType(ruleType, locale),
      count,
      percentage: totalRules > 0 ? Math.max(1, Math.round((count / totalRules) * 100)) : 0
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    totalRules,
    domainCount: domains.length,
    functionalityCount: functionalityKeys.size,
    activeWorkflowDecisions,
    domains,
    ruleTypes
  };
}
