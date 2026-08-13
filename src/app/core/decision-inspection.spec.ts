import { describe, expect, it } from 'vitest';
import { collectFactPaths, formatDecisionExpression } from './decision-inspection';

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
});
