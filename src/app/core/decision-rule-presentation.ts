import type { DecisionComparisonOperator } from './decision-inspection';
import { extractDecisionTableProjection } from './decision-inspection';
import {
  formatFactDisplayLabel,
  humanizeFactSensitivityPosture,
  humanizeFactValueTypeLabel
} from './fact-presentation';
import { humanizeTechnicalSlug, localizeGenericUnit } from './humanize-labels';
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

const PT_BR_TABLE_OPERATORS: Readonly<Record<DecisionComparisonOperator, string>> = {
  '<=': 'menor ou igual a (≤)',
  '<': 'menor que (<)',
  '>=': 'maior ou igual a (≥)',
  '>': 'maior que (>)',
  '===': 'exatamente igual a (=)',
  '!==': 'estritamente diferente de (≠)',
  '==': 'igual a (=)',
  '!=': 'diferente de (≠)',
  in: 'está entre'
};

const EN_US_TABLE_OPERATORS: Readonly<Record<DecisionComparisonOperator, string>> = {
  '<=': 'less than or equal to (≤)',
  '<': 'less than (<)',
  '>=': 'greater than or equal to (≥)',
  '>': 'greater than (>)',
  '===': 'exactly equal to (=)',
  '!==': 'strictly differs from (≠)',
  '==': 'equals (=)',
  '!=': 'differs from (≠)',
  in: 'is one of'
};

/**
 * Formats table-mode comparison operators cleanly for business vs. technical users
 * without altering the canonical operator value bound to `<option [value]>`.
 */
export function formatTableOperatorLabel(
  operator: DecisionComparisonOperator,
  locale: SupportedLocale,
  viewDepth: StudioViewDepth
): string {
  if (viewDepth === 'technical') {
    return operator;
  }
  const table = locale === 'pt-BR' ? PT_BR_TABLE_OPERATORS : EN_US_TABLE_OPERATORS;
  return table[operator] ?? operator;
}

/**
 * Builds the localized label map (`fact.path` + bound parameter keys) used by
 * business-mode expression formatters and editors.
 */
export function buildExpressionFactLabels(
  decision: Pick<DecisionSummary, 'facts'> | null | undefined,
  parameters: readonly RuleParameterDisplayEntry[],
  locale: SupportedLocale
): Readonly<Record<string, string>> {
  const labels: Record<string, string> = {};
  for (const fact of decision?.facts ?? []) {
    const label = humanizeFactLabel(fact, locale, 'business');
    labels[fact.path] = label;
    const normalizedPath = fact.path.replace(/:/g, '.');
    if (normalizedPath !== fact.path) {
      labels[normalizedPath] = label;
    }
  }
  for (const param of parameters) {
    const paramText =
      param.valueText && param.valueText !== '—'
        ? `${param.label} (${param.valueText})`
        : param.label;
    labels[`params.${param.key}`] = paramText;
    labels[`param.${param.key}`] = paramText;
    labels[`parameters.${param.key}`] = paramText;
    if (!(param.key in labels)) {
      labels[param.key] = paramText;
    }
  }
  return labels;
}

export function humanizeFactLabel(
  fact: Pick<DecisionFact, 'label' | 'path'>,
  locale: SupportedLocale,
  viewDepth: StudioViewDepth
): string {
  return formatFactDisplayLabel(fact, locale, viewDepth, true);
}

export function formatFactConditionValue(
  fact: Pick<DecisionFact, 'valueType' | 'valuePresentation' | 'unit' | 'allowedValues' | 'sensitivity' | 'redaction'> | undefined,
  rawValue: string,
  valueKind: string | undefined,
  locale: SupportedLocale,
  viewDepth: StudioViewDepth
): string {
  if (viewDepth === 'technical') {
    return rawValue;
  }
  const restricted = fact?.sensitivity === 'SECRET' || fact?.redaction === 'OMIT';
  const trimmed = rawValue.trim();

  if (valueKind === 'array') {
    const items = trimmed
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    if (items.length > 0) {
      return items
        .map(item => formatSingleFactConditionScalar(fact, item, undefined, locale, restricted))
        .join(', ');
    }
    return rawValue;
  }

  return formatSingleFactConditionScalar(fact, trimmed, valueKind, locale, restricted, rawValue);
}

function formatSingleFactConditionScalar(
  fact: Pick<DecisionFact, 'valueType' | 'valuePresentation' | 'unit' | 'allowedValues' | 'sensitivity' | 'redaction'> | undefined,
  trimmed: string,
  valueKind: string | undefined,
  locale: SupportedLocale,
  restricted: boolean,
  fallbackRaw = trimmed
): string {
  if (!restricted && fact?.allowedValues?.length) {
    const numericCandidate = trimmed !== '' && Number.isFinite(Number(trimmed)) ? Number(trimmed) : null;
    const matchedOption = fact.allowedValues.find(opt => {
      if (String(opt.value) === trimmed) return true;
      return typeof opt.value === 'number' && numericCandidate !== null && opt.value === numericCandidate;
    });
    if (matchedOption) {
      return matchedOption.label?.trim() || String(matchedOption.value);
    }
  }
  if (valueKind === 'boolean' || fact?.valueType === 'boolean') {
    const lower = trimmed.toLowerCase();
    if (lower === 'true' || lower === 'false') {
      const truthy = lower === 'true';
      return locale === 'pt-BR' ? (truthy ? 'Sim' : 'Não') : (truthy ? 'Yes' : 'No');
    }
  }
  const presentation = fact?.valuePresentation?.trim().toLowerCase();
  if ((fact?.valueType === 'date' || presentation === 'date') && /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    const utcDate = new Date(Date.UTC(year!, month! - 1, day!));
    if (!Number.isNaN(utcDate.getTime())) {
      try {
        return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeZone: 'UTC' }).format(utcDate);
      } catch {
        return trimmed;
      }
    }
  }
  if (presentation === 'datetime' && /^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    const parsedDate = new Date(trimmed);
    if (!Number.isNaN(parsedDate.getTime())) {
      try {
        return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(parsedDate);
      } catch {
        return trimmed;
      }
    }
  }
  const numericValue = trimmed !== '' && Number.isFinite(Number(trimmed)) ? Number(trimmed) : null;
  if (numericValue !== null && fact) {
    const rawUnit = fact.unit?.trim();
    const localizedUnit = localizeGenericUnit(rawUnit, locale);
    if (presentation === 'currency') {
      const currencyCode = rawUnit && /^[A-Z]{3}$/i.test(rawUnit) ? rawUnit.toUpperCase() : 'BRL';
      try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(numericValue);
      } catch {
        return localizedUnit ? `${fallbackRaw} ${localizedUnit}` : fallbackRaw;
      }
    }
    if (presentation === 'percentage') {
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(numericValue)}%`;
    }
    const formattedNumber = presentation === 'integer'
      ? new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.trunc(numericValue))
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(numericValue);
    if (localizedUnit) {
      return `${formattedNumber} ${localizedUnit}`;
    }
    return formattedNumber;
  }
  return fallbackRaw;
}

export function buildReadableRuleSummary(
  decision: DecisionSummary,
  parameters: readonly RuleParameterDisplayEntry[],
  locale: SupportedLocale,
  viewDepth: StudioViewDepth
): ReadableRuleSummary {
  const sourceCondition = decision.workspaceCondition ?? decision.condition;
  const projection = extractDecisionTableProjection(sourceCondition);
  const factByPath = new Map<string, DecisionFact>();
  const factLookup = new Map<string, string>();
  for (const fact of decision.facts) {
    factByPath.set(fact.path, fact);
    factLookup.set(fact.path, humanizeFactLabel(fact, locale, viewDepth));
  }
  const paramLookup = new Map<string, RuleParameterDisplayEntry>();
  for (const param of parameters) {
    paramLookup.set(param.key.toLowerCase(), param);
  }
  const operatorTable = locale === 'pt-BR' ? PT_BR_OPERATORS : EN_US_OPERATORS;

  const clauses: ReadableRuleClause[] = projection.clauses.map((clause) => {
    const matchedFact = factByPath.get(clause.factPath);
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
    } else {
      valueText = formatFactConditionValue(
        matchedFact,
        clause.rawValue,
        clause.valueKind,
        locale,
        viewDepth
      );
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
