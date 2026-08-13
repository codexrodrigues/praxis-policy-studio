import { describe, expect, it } from 'vitest';
import { canonicalDecisionExpression, collectFactPaths, formatDecisionExpression } from './decision-inspection';

const condition = {
  or: [
    { '===': [{ coalesce: [{ var: 'regraFrequenciaCommand.quantidadeMaximaDias' }, null] }, null] },
    { '>=': [{ var: 'regraFrequenciaCommand.quantidadeMaximaDias' }, { var: 'regraFrequenciaCommand.quantidadeMinimaDias' }] }
  ]
};

describe('decision inspection projection', () => {
  it('renders the governed condition without exposing raw JSON as the primary view', () => {
    expect(formatDecisionExpression(condition)).toBe(
      '(valor(quantidadeMaximaDias) === nulo) OU (quantidadeMaximaDias >= quantidadeMinimaDias)'
    );
  });

  it('extracts stable fact paths from the condition', () => {
    expect(collectFactPaths(condition)).toEqual([
      'regraFrequenciaCommand.quantidadeMaximaDias',
      'regraFrequenciaCommand.quantidadeMinimaDias'
    ]);
  });

  it('compares expressions independently of object key insertion order', () => {
    expect(canonicalDecisionExpression({ or: [{ var: 'amount' }], meta: { b: 2, a: 1 } }))
      .toBe(canonicalDecisionExpression({ meta: { a: 1, b: 2 }, or: [{ var: 'amount' }] }));
    expect(canonicalDecisionExpression({ '>': [{ var: 'amount' }, 0] }))
      .not.toBe(canonicalDecisionExpression({ '>=': [{ var: 'amount' }, 0] }));
  });
});
