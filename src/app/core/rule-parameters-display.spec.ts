import { describe, expect, it } from 'vitest';
import type { DecisionSummary } from '../features/catalog/catalog.fixture';
import { buildRuleParameterDisplayEntries } from './rule-parameters-display';

function makeDecisionWithParams(): DecisionSummary {
  return {
    order: 1,
    totalDecisions: 1,
    key: 'workforce.retroactive',
    code: 'WF-01',
    name: 'Janela retroativa',
    domain: 'workforce',
    ruleSet: 'Frequências',
    ruleSetKey: 'workforce.frequencias',
    resourceKey: 'workforce.attendance',
    serviceKey: 'workforce',
    state: 'verified',
    meaning: 'Janela retroativa',
    authority: 'CONFIG',
    baselineAuthority: 'SEED',
    source: 'config',
    evidenceCount: 0,
    authoringSupported: true,
    availableDefinitionActions: [],
    expression: null,
    condition: null,
    factPaths: [],
    facts: [],
    nullSemantics: 'FAIL_CLOSED',
    operationKeys: ['CREATE'],
    hostContractVersion: '1.0',
    evidence: [],
    draftLifecycle: null,
    parameterCatalog: {
      definitionId: 'def-1',
      ruleKey: 'workforce.retroactive',
      version: 1,
      schemaVersion: '1.0',
      templateKey: 'retroactive',
      templateVersion: '1',
      parameters: [
        {
          name: 'minRetroactiveDays',
          label: 'Min Retroactive Days',
          type: 'INTEGER',
          required: true,
          nullable: false,
          readOnly: false,
          defaultValue: 0,
          effectiveValue: 0,
          unit: 'days'
        },
        {
          name: 'maxRetroactiveDays',
          label: 'Max Retroactive Days',
          type: 'INTEGER',
          required: true,
          nullable: false,
          readOnly: false,
          defaultValue: 60,
          effectiveValue: 30,
          unit: 'days'
        },
        {
          name: 'optionalQuota',
          label: 'Optional Quota',
          type: 'INTEGER',
          required: false,
          nullable: true,
          readOnly: false,
          defaultValue: 10,
          effectiveValue: null,
          unit: 'months'
        }
      ]
    }
  };
}

describe('buildRuleParameterDisplayEntries', () => {
  it('localizes generic units and flags customized values diverging from defaults', () => {
    const entries = buildRuleParameterDisplayEntries(
      makeDecisionWithParams(),
      { minRetroactiveDays: 0, maxRetroactiveDays: 30 },
      'pt-BR',
      'padrão'
    );

    expect(entries).toHaveLength(3);

    expect(entries[0]).toMatchObject({
      key: 'minRetroactiveDays',
      valueText: '0 dias',
      defaultHint: null,
      detailText: 'minRetroactiveDays',
      isCustomized: false
    });

    expect(entries[1]).toMatchObject({
      key: 'maxRetroactiveDays',
      valueText: '30 dias',
      defaultValueText: '60 dias',
      defaultHint: 'padrão: 60 dias',
      detailText: 'maxRetroactiveDays (padrão: 60 dias)',
      isCustomized: true
    });

    expect(entries[2]).toMatchObject({
      key: 'optionalQuota',
      valueText: '10 meses',
      isCustomized: false
    });
  });

  it('keeps explicit null draft overrides non-customized when fallback hits default or empty dash', () => {
    const base = makeDecisionWithParams();
    const updatedParams = base.parameterCatalog!.parameters.map((param, idx) =>
      idx === 2 ? { ...param, defaultValue: null } : param
    );
    const decision = {
      ...base,
      parameterCatalog: { ...base.parameterCatalog!, parameters: updatedParams }
    };
    const entries = buildRuleParameterDisplayEntries(decision, { optionalQuota: null }, 'en-US', 'default');
    expect(entries[2]).toMatchObject({
      valueText: '—',
      defaultValueText: null,
      isCustomized: false
    });
  });
});
