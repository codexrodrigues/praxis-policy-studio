import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { latestDefinition } from './projection-catalog.service';

describe('latestDefinition', () => {
  it('selects the greatest version for the canonical decision key independently of API order', () => {
    const definitions = [
      { id: 'v2', ruleKey: 'rule-a', version: 2, status: 'draft' },
      { id: 'other', ruleKey: 'rule-b', version: 9, status: 'draft' },
      { id: 'v3', ruleKey: 'rule-a', version: 3, status: 'draft' },
      { id: 'v1', ruleKey: 'rule-a', version: 1, status: 'draft' }
    ];

    expect(latestDefinition(definitions, 'rule-a')?.id).toBe('v3');
    expect(latestDefinition(definitions, 'missing')).toBeUndefined();
  });
});
