import { describe, expect, it } from 'vitest';
import { semanticDecisionDiff } from './semantic-decision-diff';

describe('semanticDecisionDiff', () => {
  it('describes nested operator changes without treating key order as change', () => {
    const baseline = { and: [{ '<=': [{ var: 'amount' }, 1000] }, { '===': [{ var: 'active' }, true] }] };
    const candidate = { and: [{ '<': [{ var: 'amount' }, 800] }, { '===': [{ var: 'active' }, true] }] };

    expect(semanticDecisionDiff(baseline, candidate)).toEqual([
      { path: '$.and[0].<', kind: 'ADDED', baseline: undefined, candidate: [{ var: 'amount' }, 800] },
      { path: '$.and[0].<=', kind: 'REMOVED', baseline: [{ var: 'amount' }, 1000], candidate: undefined }
    ]);
    expect(semanticDecisionDiff({ b: 2, a: 1 }, { a: 1, b: 2 })).toEqual([]);
  });

  it('reports removed array operands', () => {
    expect(semanticDecisionDiff({ in: ['x', ['x', 'y']] }, { in: ['x'] })).toEqual([
      { path: '$.in[1]', kind: 'REMOVED', baseline: ['x', 'y'], candidate: undefined }
    ]);
  });
});
