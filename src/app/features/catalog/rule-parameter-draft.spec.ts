import { describe, expect, it } from 'vitest';
import type { DomainRuleParameterDescriptor } from '@praxisui/core';
import { parameterDrafts, resolveParameterDrafts } from './rule-parameter-draft';

const limit: DomainRuleParameterDescriptor = {
  name: 'limit', type: 'NUMBER', required: true, nullable: true, readOnly: false,
  defaultValue: 3000, minimum: 0, maximum: 5000, origin: 'DEFAULT', effectiveValue: 3000
};

describe('governed parameter drafts', () => {
  it('keeps omission, explicit null and false distinct', () => {
    expect(parameterDrafts([limit], {})).toEqual({ limit: { mode: 'DEFAULT', text: '' } });
    expect(parameterDrafts([limit], { limit: null })).toEqual({ limit: { mode: 'NULL', text: '' } });
    expect(parameterDrafts([{ ...limit, type: 'BOOLEAN' }], { limit: false }))
      .toEqual({ limit: { mode: 'VALUE', text: 'false' } });
    expect(parameterDrafts([{ ...limit, origin: 'DECLARED', declaredValue: null }]))
      .toEqual({ limit: { mode: 'NULL', text: '' } });
  });

  it('round-trips typed scalars and a required default without copying effective values', () => {
    const parameters = [limit, { ...limit, name: 'count', type: 'INTEGER' as const },
      { ...limit, name: 'enabled', type: 'BOOLEAN' as const },
      { ...limit, name: 'name', type: 'STRING' as const }];
    const drafts = parameterDrafts(parameters, { count: 2, enabled: false, name: '' });
    expect(resolveParameterDrafts(parameters, drafts)).toEqual({ values: { count: 2, enabled: false, name: '' }, errors: {} });
  });

  it.each([
    ['NUMBER', '', 'parameterInvalidType'],
    ['NUMBER', 'Infinity', 'parameterInvalidType'],
    ['NUMBER', '-1', 'parameterBelowMinimum'],
    ['NUMBER', '5001', 'parameterAboveMaximum'],
    ['INTEGER', '2.1', 'parameterInvalidType'],
    ['INTEGER', '9007199254740992', 'parameterInvalidType'],
    ['BOOLEAN', '', 'parameterInvalidType']
  ] as const)('validates %s input %s', (type, text, error) => {
    expect(resolveParameterDrafts([{ ...limit, type }], { limit: { mode: 'VALUE', text } }).errors)
      .toEqual({ limit: error });
  });

  it('checks typed allowed values and nullability without changing the template', () => {
    expect(resolveParameterDrafts([{ ...limit, allowedValues: [1000, 3000] }],
      { limit: { mode: 'VALUE', text: '2000' } }).errors).toEqual({ limit: 'parameterNotAllowed' });
    expect(resolveParameterDrafts([{ ...limit, nullable: false }],
      { limit: { mode: 'NULL', text: '' } }).errors).toEqual({ limit: 'parameterNullNotAllowed' });
    expect(resolveParameterDrafts([limit], { limit: { mode: 'NULL', text: '' } }).values).toEqual({ limit: null });
    expect(resolveParameterDrafts([{ ...limit, type: 'STRING', allowedValues: [''] }],
      { limit: { mode: 'VALUE', text: '' } }).errors).toEqual({});
  });

  it('requires a declaration only when no default property exists', () => {
    const { defaultValue, ...withoutDefault } = limit;
    expect(resolveParameterDrafts([withoutDefault], {}).errors).toEqual({ limit: 'parameterRequired' });
    expect(resolveParameterDrafts([{ ...limit, defaultValue: null }], {}).errors).toEqual({});
  });

  it('preserves exact canonical names including object prototype names', () => {
    const result = resolveParameterDrafts([{ ...limit, name: '__proto__' }],
      Object.fromEntries([['__proto__', { mode: 'VALUE', text: '1' }]]));
    expect(Object.hasOwn(result.values, '__proto__')).toBe(true);
    expect(JSON.stringify(result.values)).toBe('{"__proto__":1}');
    const invalid = resolveParameterDrafts([{ ...limit, name: '__proto__' }],
      Object.fromEntries([['__proto__', { mode: 'VALUE', text: 'Infinity' }]]));
    expect(Object.hasOwn(invalid.errors, '__proto__')).toBe(true);
    expect(invalid.errors['__proto__']).toBe('parameterInvalidType');
  });
});
