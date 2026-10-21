import type { DomainRuleParameterDescriptor, DomainRuleParameterValue } from '@praxisui/core';

export interface RuleParameterDraft {
  readonly mode: 'DEFAULT' | 'VALUE' | 'NULL';
  readonly text: string;
}
export type RuleParameterDrafts = Readonly<Record<string, RuleParameterDraft>>;
export type ParameterError = 'parameterRequired' | 'parameterInvalidType' | 'parameterBelowMinimum'
  | 'parameterAboveMaximum' | 'parameterNotAllowed' | 'parameterNullNotAllowed';

export function parameterDrafts(
  descriptors: readonly DomainRuleParameterDescriptor[],
  values?: Readonly<Record<string, unknown>>
): RuleParameterDrafts {
  return Object.fromEntries(descriptors.map(parameter => {
    const declared = values ? Object.hasOwn(values, parameter.name) : parameter.origin === 'DECLARED';
    const value = values ? values[parameter.name] : parameter.declaredValue;
    return [parameter.name, { mode: !declared ? 'DEFAULT' : value === null ? 'NULL' : 'VALUE',
      text: value == null ? '' : String(value) }];
  }));
}

export function resolveParameterDrafts(
  descriptors: readonly DomainRuleParameterDescriptor[], drafts: RuleParameterDrafts
): { values: Record<string, DomainRuleParameterValue>; errors: Record<string, ParameterError> } {
  const values: Record<string, DomainRuleParameterValue> = Object.create(null);
  const errors: Record<string, ParameterError> = Object.create(null);
  for (const parameter of descriptors) {
    const draft = drafts[parameter.name];
    if (!draft || draft.mode === 'DEFAULT') {
      // An absent property means no default; explicit null remains a real default.
      if (parameter.required && !Object.hasOwn(parameter, 'defaultValue')) {
        errors[parameter.name] = 'parameterRequired';
      }
      continue;
    }
    let value: DomainRuleParameterValue;
    if (draft.mode === 'NULL') {
      value = null;
      if (!parameter.nullable) errors[parameter.name] = 'parameterNullNotAllowed';
    } else if (parameter.type === 'STRING') {
      value = draft.text;
    } else if (parameter.type === 'BOOLEAN') {
      value = draft.text === 'true';
      if (!['true', 'false'].includes(draft.text)) errors[parameter.name] = 'parameterInvalidType';
    } else {
      value = Number(draft.text);
      if (!draft.text.trim() || !Number.isFinite(value)
        || (parameter.type === 'INTEGER' && !Number.isSafeInteger(value))) {
        errors[parameter.name] = 'parameterInvalidType';
      } else if (parameter.minimum != null && value < parameter.minimum) {
        errors[parameter.name] = 'parameterBelowMinimum';
      } else if (parameter.maximum != null && value > parameter.maximum) {
        errors[parameter.name] = 'parameterAboveMaximum';
      }
    }
    if (!errors[parameter.name] && parameter.allowedValues?.length
      && !parameter.allowedValues.some(allowed => allowed === value)) {
      errors[parameter.name] = 'parameterNotAllowed';
    }
    values[parameter.name] = value;
  }
  return { values, errors };
}
