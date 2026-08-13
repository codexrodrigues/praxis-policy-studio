import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { latestDefinition, newDraftVersionRequest } from './projection-catalog.service';

describe('latestDefinition', () => {
  it('selects the greatest version for the canonical decision key independently of API order', () => {
    const definitions = [
      { id: 'v2', ruleKey: 'rule-a', version: 2, ruleType: 'validation', status: 'draft' },
      { id: 'other', ruleKey: 'rule-b', version: 9, ruleType: 'validation', status: 'draft' },
      { id: 'v3', ruleKey: 'rule-a', version: 3, ruleType: 'validation', status: 'draft' },
      { id: 'v1', ruleKey: 'rule-a', version: 1, ruleType: 'validation', status: 'draft' }
    ];

    expect(latestDefinition(definitions, 'rule-a')?.id).toBe('v3');
    expect(latestDefinition(definitions, 'missing')).toBeUndefined();
  });
});

describe('newDraftVersionRequest', () => {
  it('creates the next immutable draft and invalidates stale validation evidence', () => {
    const request = newDraftVersionRequest({
      id: 'definition-v3', ruleKey: 'rule-a', version: 3, ruleType: 'validation', status: 'approved',
      contextKey: 'workforce', parameters: { nullSemantics: 'ALLOW' },
      governance: { lifecycleBoundary: 'DRAFT_ONLY' }, validationResult: { valid: true }
    }, { '>': [{ var: 'maximum' }, { var: 'minimum' }] });

    expect(request['version']).toBe(4);
    expect(request['status']).toBe('draft');
    expect(request['condition']).toEqual({ '>': [{ var: 'maximum' }, { var: 'minimum' }] });
    expect(request['validationResult']).toBeNull();
    expect(request['parameters']).toEqual({ nullSemantics: 'ALLOW' });
  });
});
