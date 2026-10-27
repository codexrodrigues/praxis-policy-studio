import { describe, expect, it } from 'vitest';
import {
  canonicalDecisionExpression,
  collectFactPaths,
  compileDecisionTableProjection,
  composeDecisionCondition,
  editableDecisionCondition,
  extractDecisionTableProjection,
  formatDecisionExpression
} from './decision-inspection';

const condition = {
  or: [
    { '===': [{ coalesce: [{ var: 'grant.maximumDays' }, null] }, null] },
    { '>=': [{ var: 'grant.maximumDays' }, { var: 'grant.minimumDays' }] }
  ]
};

describe('decision inspection projection', () => {
  it('renders the governed condition without exposing raw JSON as the primary view', () => {
    expect(formatDecisionExpression(condition)).toBe(
      '(valor(grant.maximumDays) === nulo) OU (grant.maximumDays >= grant.minimumDays)'
    );
  });

  it('supports semantic fact labels, membership, strict inequality, negation, and arithmetic operators', () => {
    const complexCondition = {
      and: [
        { '!==': [{ var: 'actor.permissions' }, null] },
        { in: ['benefit:request', { var: 'actor.permissions' }] },
        { '<=': [{ var: 'request.requestedAmount' }, { '*': [{ var: 'program.maxAmount' }, 1] }] },
        { '!': [{ var: 'grant.hasDuplicate' }] }
      ]
    };
    expect(formatDecisionExpression(complexCondition, {
      'actor.permissions': 'Actor permissions',
      'request.requestedAmount': 'Requested amount',
      'program.maxAmount': 'Program limit',
      'grant.hasDuplicate': 'Duplicate grant'
    })).toBe(
      '(Actor permissions !== nulo) E (benefit:request in Actor permissions) E (Requested amount <= Program limit * 1) E (!(Duplicate grant))'
    );
  });

  it('extracts stable fact paths from the condition', () => {
    expect(collectFactPaths(condition)).toEqual([
      'grant.maximumDays',
      'grant.minimumDays'
    ]);
  });

  it('compares expressions independently of object key insertion order', () => {
    expect(canonicalDecisionExpression({ or: [{ var: 'amount' }], meta: { b: 2, a: 1 } }))
      .toBe(canonicalDecisionExpression({ meta: { a: 1, b: 2 }, or: [{ var: 'amount' }] }));
    expect(canonicalDecisionExpression({ '>': [{ var: 'amount' }, 0] }))
      .not.toBe(canonicalDecisionExpression({ '>=': [{ var: 'amount' }, 0] }));
  });
});

describe('governed decision editing envelope', () => {
  const maximum = { var: 'grant.maximumDays' };
  const minimum = { var: 'grant.minimumDays' };
  const original = { or: [
    { '===': [{ coalesce: [maximum] }, null] },
    { '===': [{ coalesce: [minimum] }, null] },
    { '>=': [maximum, minimum] }
  ] };

  it('edits only the configurable branch and preserves explicit null guards', () => {
    expect(editableDecisionCondition(original)).toEqual({ '>=': [maximum, minimum] });
    expect(composeDecisionCondition(original, { '>': [maximum, minimum] })).toEqual({ or: [
      { '===': [{ coalesce: [maximum] }, null] },
      { '===': [{ coalesce: [minimum] }, null] },
      { '>': [maximum, minimum] }
    ] });
  });

  it('does not infer an envelope when the preceding branches are business conditions', () => {
    const businessOr = { or: [{ '>': [maximum, 10] }, { '>=': [maximum, minimum] }] };
    expect(editableDecisionCondition(businessOr)).toEqual(businessOr);
    expect(composeDecisionCondition(businessOr, { '<': [maximum, minimum] })).toEqual({ '<': [maximum, minimum] });

    const directNullPolicy = { or: [{ '===': [maximum, null] }, { '>=': [maximum, minimum] }] };
    expect(editableDecisionCondition(directNullPolicy)).toEqual(directNullPolicy);
  });

  it('projects and compiles tabular decision clauses without exposing raw JSON', () => {
    const tabularCondition = {
      and: [
        { '<=': [{ var: 'request.requestedAmount' }, 3000] },
        { '===': [{ var: 'applicant.activeEnrollment' }, true] },
        { in: [{ var: 'request.category' }, ['EMERGENCY', 'HEALTH']] }
      ]
    };

    const projection = extractDecisionTableProjection(tabularCondition);
    expect(projection).toEqual({
      combinator: 'and',
      lossless: true,
      clauses: [
        { factPath: 'request.requestedAmount', operator: '<=', rawValue: '3000', valueKind: 'number' },
        { factPath: 'applicant.activeEnrollment', operator: '===', rawValue: 'true', valueKind: 'boolean' },
        { factPath: 'request.category', operator: 'in', rawValue: 'EMERGENCY, HEALTH', valueKind: 'array' }
      ]
    });

    expect(compileDecisionTableProjection(projection)).toEqual(tabularCondition);
  });

  it('marks nested or coalesce-wrapped conditions as non-lossless so table mode prevents destructive flattening', () => {
    const coalescedCondition = {
      '<=': [{ coalesce: [{ var: 'request.requestedAmount' }, 0] }, 3000]
    };
    const coalescedProjection = extractDecisionTableProjection(coalescedCondition);
    expect(coalescedProjection.lossless).toBe(false);
    expect(coalescedProjection.clauses).toEqual([
      { factPath: 'request.requestedAmount', operator: '<=', rawValue: '3000', valueKind: 'number' }
    ]);

    const nestedCondition = {
      and: [
        { '<=': [{ var: 'request.requestedAmount' }, 3000] },
        { '!': [{ '===': [{ var: 'grant.hasDuplicate' }, true] }] }
      ]
    };
    const nestedProjection = extractDecisionTableProjection(nestedCondition);
    expect(nestedProjection.lossless).toBe(false);
    expect(nestedProjection.clauses).toHaveLength(2);
  });
});
