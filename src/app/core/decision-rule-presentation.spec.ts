import { describe, expect, it } from 'vitest';
import type { DecisionSummary } from '../features/catalog/catalog.fixture';
import {
  buildReadableRuleSummary,
  humanizeBaselineAuthority,
  humanizeFactLabel,
  humanizeFactSensitivity,
  humanizeFactValueType,
  humanizeSemanticDiffKind
} from './decision-rule-presentation';
import { buildRuleParameterDisplayEntries } from './rule-parameters-display';

function makeDecision(overrides: Partial<DecisionSummary> = {}): DecisionSummary {
  return {
    order: 1,
    totalDecisions: 1,
    key: 'workforce.attendance.retroactive',
    code: 'WF-10',
    name: 'Lançamento retroativo',
    domain: 'human-resources.attendance',
    ruleSet: 'Frequências · Lançamento',
    ruleSetKey: 'human-resources.attendance.launch',
    resourceKey: 'human-resources.attendance',
    serviceKey: 'attendance-service',
    state: 'verified',
    meaning: 'Valida janela máxima de lançamento retroativo.',
    authority: 'CONFIG_AUTHORITATIVE',
    baselineAuthority: 'LEGACY_RECOVERED',
    source: 'config',
    evidenceCount: 1,
    authoringSupported: true,
    availableDefinitionActions: [],
    expression: 'retroactiveDays <= maxRetroactiveDays',
    condition: {
      and: [
        { '<=': [{ var: 'draft:retroactiveDays' }, { var: 'params.maxRetroactiveDays' }] },
        { '==': [{ var: 'draft:approvedByManager' }, true] }
      ]
    },
    factPaths: ['draft:retroactiveDays', 'draft:approvedByManager'],
    facts: [
      {
        path: 'draft:retroactiveDays',
        valueType: 'number',
        nullable: false,
        label: 'retroactiveDays',
        description: 'Dias retroativos informados',
        providerRef: 'attendance',
        evidenceRefs: [],
        sensitivity: 'PERSONAL',
        redaction: 'NONE'
      },
      {
        path: 'draft:approvedByManager',
        valueType: 'boolean',
        nullable: false,
        label: 'Aprovação gerencial',
        description: 'Indica aceite prévio da chefia',
        providerRef: 'attendance',
        evidenceRefs: [],
        sensitivity: 'SENSITIVE',
        redaction: 'MASK'
      }
    ],
    nullSemantics: 'FAIL_CLOSED',
    operationKeys: ['CREATE'],
    hostContractVersion: '1.0',
    evidence: [],
    draftLifecycle: null,
    parameterCatalog: {
      definitionId: 'def-1',
      ruleKey: 'workforce.attendance.retroactive',
      version: 1,
      schemaVersion: '1.0',
      templateKey: 'retroactive-window',
      templateVersion: '1',
      parameters: [
        {
          name: 'maxRetroactiveDays',
          label: 'Limite de dias retroativos',
          type: 'INTEGER',
          required: true,
          nullable: false,
          readOnly: false,
          defaultValue: 60,
          effectiveValue: 30,
          unit: 'days'
        }
      ]
    },
    ...overrides
  };
}

describe('decision-rule-presentation', () => {
  it('builds readable natural-language clauses resolving fact labels and bound parameters in business mode', () => {
    const decision = makeDecision();
    const params = buildRuleParameterDisplayEntries(decision, {}, 'pt-BR', 'padrão');

    const summary = buildReadableRuleSummary(decision, params, 'pt-BR', 'business');
    expect(summary.lossless).toBe(true);
    expect(summary.combinator).toBe('and');
    expect(summary.clauses).toEqual([
      {
        factLabel: 'Retroactive Days',
        factPath: 'draft:retroactiveDays',
        operatorLabel: 'for menor ou igual a',
        valueText: 'Limite de dias retroativos (30 dias)',
        parameterLabel: 'Limite de dias retroativos'
      },
      {
        factLabel: 'Aprovação gerencial',
        factPath: 'draft:approvedByManager',
        operatorLabel: 'for igual a',
        valueText: 'Sim',
        parameterLabel: null
      }
    ]);
  });

  it('preserves raw contract symbols and paths in technical viewDepth', () => {
    const decision = makeDecision();
    const params = buildRuleParameterDisplayEntries(decision, {}, 'en-US', 'default');

    expect(humanizeFactLabel(decision.facts[0], 'en-US', 'technical')).toBe('retroactiveDays');
    const summary = buildReadableRuleSummary(decision, params, 'en-US', 'technical');
    expect(summary.clauses[0]?.operatorLabel).toBe('<=');
    expect(summary.clauses[1]?.valueText).toBe('true');
    expect(humanizeBaselineAuthority('LEGACY_RECOVERED', 'pt-BR', 'technical')).toBe('LEGACY_RECOVERED');
    expect(humanizeBaselineAuthority('LEGACY_RECOVERED', 'pt-BR', 'business')).toBe(
      'Regra recuperada do sistema de origem'
    );
  });

  it('humanizes fact value types, LGPD sensitivity postures, and semantic diff kinds in pt-BR and en-US', () => {
    expect(humanizeFactValueType('date', 'pt-BR')).toBe('Data');
    expect(humanizeFactValueType('boolean', 'en-US')).toBe('Yes / No');
    expect(humanizeFactSensitivity('SENSITIVE', 'pt-BR')).toEqual({
      label: 'Sensível / LGPD',
      tone: 'warning'
    });
    expect(humanizeFactSensitivity('SECRET', 'en-US')).toEqual({
      label: 'Restricted',
      tone: 'danger'
    });
    expect(humanizeSemanticDiffKind('CHANGED', 'pt-BR')).toBe('Alterado');
    expect(humanizeSemanticDiffKind('ADDED', 'en-US')).toBe('Added');
  });
});
