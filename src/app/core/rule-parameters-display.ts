import type { SupportedLocale } from './runtime-config';
import { humanizeTechnicalSlug, localizeGenericUnit } from './humanize-labels';
import type { DecisionSummary } from '../features/catalog/catalog.fixture';

export interface RuleParameterDisplayEntry {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly valueText: string;
  readonly defaultValueText: string | null;
  readonly defaultHint: string | null;
  readonly detailText: string;
  readonly isCustomized: boolean;
}

/**
 * Formats governed rule parameters with localized generic units and explicit divergence
 * detection (`isCustomized`) between the effective/override value and factory default.
 */
export function buildRuleParameterDisplayEntries(
  decision: DecisionSummary,
  effectiveValues: Readonly<Record<string, unknown>>,
  locale: SupportedLocale,
  defaultPrefix: string
): readonly RuleParameterDisplayEntry[] {
  const params = decision.parameterCatalog?.parameters ?? [];
  return params.map((param) => {
    const current =
      effectiveValues[param.name] ??
      param.effectiveValue ??
      param.declaredValue ??
      param.defaultValue;
    const rawValue = formatRawParameterValue(current);
    const localizedUnit = localizeGenericUnit(param.unit, locale);
    const unitSuffix = localizedUnit ? ` ${localizedUnit}` : '';
    const valueText = rawValue === '—' ? rawValue : `${rawValue}${unitSuffix}`;
    const defaultRaw =
      param.defaultValue === undefined || param.defaultValue === null || param.defaultValue === ''
        ? null
        : formatRawParameterValue(param.defaultValue);
    const defaultValueText = defaultRaw !== null ? `${defaultRaw}${unitSuffix}` : null;
    const isCustomized = defaultRaw !== null && rawValue !== '—' && defaultRaw !== rawValue;
    const defaultHint = isCustomized && defaultValueText ? `${defaultPrefix}: ${defaultValueText}` : null;
    const detailText = defaultHint ? `${param.name} (${defaultHint})` : param.name;

    return {
      key: param.name,
      label: param.label || humanizeTechnicalSlug(param.name, undefined, locale),
      description: param.description || `${param.type}${localizedUnit ? ` · ${localizedUnit}` : ''}`,
      valueText,
      defaultValueText,
      defaultHint,
      detailText,
      isCustomized
    };
  });
}

function formatRawParameterValue(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '—';
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
