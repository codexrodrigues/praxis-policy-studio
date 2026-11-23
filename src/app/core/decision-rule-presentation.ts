import type { DecisionComparisonOperator } from './decision-inspection';
import { extractDecisionTableProjection } from './decision-inspection';
import {
  formatFactDisplayLabel,
  humanizeFactSensitivityPosture,
  humanizeFactValueTypeLabel
} from './fact-presentation';
import { humanizeTechnicalSlug } from './humanize-labels';
import { POLICY_STUDIO_COPY } from './i18n';
import type { RuleParameterDisplayEntry } from './rule-parameters-display';
import type { SupportedLocale } from './runtime-config';
import type { StudioViewDepth } from './studio-shell-state.service';
import type { DecisionFact, DecisionSummary } from '../features/catalog/catalog.fixture';

export interface ReadableRuleClause {
  readonly factLabel: string;
  readonly factPath: string;
  readonly operatorLabel: string;
  readonly valueText: string;
  readonly parameterLabel: string | null;
}

export interface ReadableRuleSummary {
  readonly combinator: 'and' | 'or';
  readonly clauses: readonly ReadableRuleClause[];
  readonly lossless: boolean;
}

const PT_BR_OPERATORS: Readonly<Record<DecisionComparisonOperator, string>> = {
  '<=': 'for menor ou igual a',
  '<': 'for menor que',
  '>=': 'for maior ou igual a',
  '>': 'for maior que',
  '===': 'for exatamente igual a',
  '==': 'for igual a',
  '!==': 'for diferente de',
  '!=': 'for diferente de',
  'in': 'estiver entre'
};

const EN_US_OPERATORS: Readonly<Record<DecisionComparisonOperator, string>> = {
  '<=': 'is less than or equal to',
  '<': 'is less than',
  '>=': 'is greater than or equal to',
  '>': 'is greater than',
  '===': 'is exactly equal to',
  '==': 'equals',
  '!==': 'differs from',
  '!=': 'differs from',
  'in': 'is one of'
};

export function humanizeFactLabel(
  fact: Pick<DecisionFact, 'label' | 'path'>,
  locale: SupportedLocale,
  viewDepth: StudioViewDepth
): string {
  return formatFactDisplayLabel(fact, locale, viewDepth, true);
}

export function buildReadableRuleSummary(
  decision: DecisionSummary,
  parameters: readonly RuleParameterDisplayEntry[],
  locale: SupportedLocale,
  viewDepth: StudioViewDepth
): ReadableRuleSummary {
  const sourceCondition = decision.workspaceCondition ?? decision.condition;
  const projection = extractDecisionTableProjection(sourceCondition);
  const factLookup = new Map<string, string>();
  for (const fact of decision.facts) {
    factLookup.set(fact.path, humanizeFactLabel(fact, locale, viewDepth));
  }
  const paramLookup = new Map<string, RuleParameterDisplayEntry>();
  for (const param of parameters) {
    paramLookup.set(param.key.toLowerCase(), param);
  }
  const operatorTable = locale === 'pt-BR' ? PT_BR_OPERATORS : EN_US_OPERATORS;

  const clauses: ReadableRuleClause[] = projection.clauses.map((clause) => {
    const factLabel =
      factLookup.get(clause.factPath) ??
      (viewDepth === 'technical'
        ? clause.factPath
        : humanizeTechnicalSlug(clause.factPath, undefined, locale) || clause.factPath);
    const operatorLabel =
      viewDepth === 'technical' ? clause.operator : (operatorTable[clause.operator] ?? clause.operator);

    let parameterLabel: string | null = null;
    let valueText = clause.rawValue;

    if (clause.valueKind === 'var') {
      const normalizedParamKey = clause.rawValue.replace(/^para(ms?|meters)\./i, '').toLowerCase();
      const matchedParam =
        paramLookup.get(clause.rawValue.toLowerCase()) ?? paramLookup.get(normalizedParamKey);
      const matchedFactLabel = factLookup.get(clause.rawValue);
      if (matchedParam) {
        parameterLabel = matchedParam.label;
        valueText =
          matchedParam.valueText && matchedParam.valueText !== '—'
            ? `${matchedParam.label} (${matchedParam.valueText})`
            : matchedParam.label;
      } else if (matchedFactLabel) {
        valueText = matchedFactLabel;
      } else if (viewDepth !== 'technical') {
        valueText = humanizeTechnicalSlug(clause.rawValue, undefined, locale) || clause.rawValue;
      }
    } else if (clause.valueKind === 'boolean' && viewDepth !== 'technical') {
      const truthy = clause.rawValue.toLowerCase() === 'true';
      valueText = locale === 'pt-BR' ? (truthy ? 'Sim' : 'Não') : (truthy ? 'Yes' : 'No');
    }

    return {
      factLabel,
      factPath: clause.factPath,
      operatorLabel,
      valueText,
      parameterLabel
    };
  });

  return {
    combinator: projection.combinator,
    clauses,
    lossless: projection.lossless
  };
}

export function humanizeFactValueType(
  valueType: string | null | undefined,
  locale: SupportedLocale
): string {
  return humanizeFactValueTypeLabel(valueType, locale);
}

export function humanizeFactSensitivity(
  sensitivity: string | null | undefined,
  locale: SupportedLocale
): { readonly label: string; readonly tone: 'neutral' | 'info' | 'warning' | 'danger' } {
  return humanizeFactSensitivityPosture(sensitivity, locale);
}

export function humanizeBaselineAuthority(
  authority: string | null | undefined,
  locale: SupportedLocale,
  viewDepth: StudioViewDepth
): string {
  const raw = authority?.trim() ?? '';
  const dict = POLICY_STUDIO_COPY[locale];
  if (!raw) {
    return dict.notInformed;
  }
  if (viewDepth === 'technical') {
    return raw;
  }
  const upper = raw.toUpperCase();
  if (upper.includes('LEGACY')) {
    return dict.ruleAuthorityLegacy;
  }
  if (upper.includes('CONFIG')) {
    return dict.ruleAuthorityConfig;
  }
  return dict.ruleAuthorityCatalog;
}

export function humanizeSemanticDiffKind(
  kind: string,
  locale: SupportedLocale
): string {
  const upper = kind.trim().toUpperCase();
  const dict = POLICY_STUDIO_COPY[locale];
  if (upper === 'ADDED' || upper === 'ADD') {
    return dict.ruleDiffAdded;
  }
  if (upper === 'REMOVED' || upper === 'REMOVE' || upper === 'DELETED') {
    return dict.ruleDiffRemoved;
  }
  if (upper === 'CHANGED' || upper === 'MODIFIED' || upper === 'UPDATED') {
    return dict.ruleDiffChanged;
  }
  return kind;
}
