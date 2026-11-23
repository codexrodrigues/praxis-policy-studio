import { describe, expect, it } from 'vitest';
import {
  formatFactDisplayLabel,
  formatFactPopoverModel,
  groupFactsForDisplay,
  humanizeFactRedaction,
  isParameterFactPath,
  partitionDecisionFacts,
  resolveFactGroup,
  splitFactDescriptionAndHint
} from './fact-presentation';
import type { DecisionFact, DecisionSummary } from '../features/catalog/catalog.fixture';

function makeFact(overrides: Partial<DecisionFact> = {}): DecisionFact {
  return {
    path: 'draft.dtini',
    valueType: 'date',
    nullable: true,
    label: 'draft: dtini',
    description: 'Data de início do período.',
    providerRef: 'workforce.attendance',
    evidenceRefs: [],
    sensitivity: 'NON_SENSITIVE',
    redaction: 'NONE',
    ...overrides
  };
}

function makeDecision(overrides: Partial<DecisionSummary> = {}): DecisionSummary {
  return {
    order: 1,
    totalDecisions: 1,
    key: 'workforce.attendance.period-check',
    code: 'WF-001',
    name: 'Validação de período',
    domain: 'workforce',
    ruleSet: 'Attendance · Launch',
    ruleSetKey: 'workforce.attendance.launch',
    resourceKey: 'workforce.attendance',
    serviceKey: 'workforce-service',
    state: 'verified',
    meaning: 'Verifica datas do período.',
    authority: 'CONFIG',
    baselineAuthority: 'LEGACY_RECOVERED',
    source: 'definition:1',
    evidenceCount: 0,
    authoringSupported: true,
    availableDefinitionActions: [],
    expression: 'draft.dtini <= employment.vacDate',
    condition: {
      '<=': [{ var: 'draft.dtini' }, { var: 'employment.vacDate' }]
    },
    factPaths: ['draft.dtini', 'employment.vacDate', 'neighborhood.history'],
    evaluatedFactPaths: ['draft.dtini', 'employment.vacDate'],
    facts: [
      makeFact({ path: 'draft.dtini', label: 'draft: dtini' }),
      makeFact({ path: 'employment.vacDate', label: 'employment: vacDate', nullable: false }),
      makeFact({
        path: 'neighborhood.history',
        valueType: 'string-array',
        label: 'neighborhood: history',
        description: 'Fato de avaliação do RuleSet workforce.attendance.launch (neighborhood.history).'
      })
    ],
    nullSemantics: 'FAIL_CLOSED',
    operationKeys: ['CREATE'],
    hostContractVersion: '1.0',
    evidence: [],
    draftLifecycle: null,
    ...overrides
  };
}

describe('fact-presentation', () => {
  it('identifies parameter paths and separates operational guidance hints from descriptions', () => {
    expect(isParameterFactPath('params.maxDays')).toBe(true);
    expect(isParameterFactPath('parameters.limit')).toBe(true);
    expect(isParameterFactPath('draft.maxDays')).toBe(false);

    expect(
      splitFactDescriptionAndHint(
        'Data de início informada no lançamento. Orientação operacional: Use formato AAAA-MM-DD.'
      )
    ).toEqual({
      description: 'Data de início informada no lançamento.',
      hint: 'Use formato AAAA-MM-DD.',
      isTemplatePlaceholder: false
    });

    expect(
      splitFactDescriptionAndHint(
        'Fato de avaliação do RuleSet workforce.attendance (draft.cod).',
        'Informe um código ativo no cadastro.'
      )
    ).toEqual({
      description: '',
      hint: 'Informe um código ativo no cadastro.',
      isTemplatePlaceholder: true
    });
  });

  it('partitions rule-evaluated facts from catalog-only operation facts with safe fallback', () => {
    const decision = makeDecision();
    const scoped = partitionDecisionFacts(decision);
    expect(scoped.scopedByRule).toBe(true);
    expect(scoped.evaluatedFacts.map(f => f.path)).toEqual(['draft.dtini', 'employment.vacDate']);
    expect(scoped.catalogOnlyFacts.map(f => f.path)).toEqual(['neighborhood.history']);

    const unmatched = partitionDecisionFacts(
      makeDecision({
        condition: { '==': [{ var: 'unknown.field' }, true] },
        evaluatedFactPaths: ['unknown.field']
      })
    );
    expect(unmatched.scopedByRule).toBe(false);
    expect(unmatched.evaluatedFacts).toHaveLength(3);
  });

  it('strips technical root prefixes cleanly in business mode while preserving technical fidelity', () => {
    const fact = makeFact({ path: 'neighborhood.regrasEstatutarias', label: 'neighborhood: regrasEstatutarias' });
    expect(formatFactDisplayLabel(fact, 'pt-BR', 'business')).toBe('Regras Estatutárias');
    expect(formatFactDisplayLabel(fact, 'pt-BR', 'technical')).toBe('neighborhood: regrasEstatutarias');

    const titleCasePrefixed = makeFact({ path: 'record.docId', label: 'Documento Legal ID' });
    expect(formatFactDisplayLabel(titleCasePrefixed, 'pt-BR', 'business')).toBe('Documento Legal ID');
  });

  it('resolves origin groups and builds rich business popovers without raw nullable or path leakage', () => {
    const draftFact = makeFact({
      path: 'draft.dtini',
      valueType: 'date',
      nullable: true,
      label: 'Data de início',
      description: 'Início do afastamento.',
      hint: 'Deve ser anterior à vacância.',
      unit: 'data',
      sensitivity: 'PERSONAL',
      redaction: 'MASK'
    });
    const businessPopover = formatFactPopoverModel(draftFact, 'pt-BR', 'business');
    expect(businessPopover.category).toBe('Dados do registro');
    expect(businessPopover.hint).toBe('Deve ser anterior à vacância.');
    expect(businessPopover.detail).toBeNull();
    expect(businessPopover.metaTags.map(tag => tag.label)).toEqual([
      'Data',
      'Opcional',
      'data',
      'Dado pessoal · Mascarado'
    ]);

    const technicalPopover = formatFactPopoverModel(draftFact, 'pt-BR', 'technical');
    expect(technicalPopover.category).toBe('draft · date');
    expect(technicalPopover.detail).toBe('Path: draft.dtini · workforce.attendance');
    expect(technicalPopover.metaTags.map(tag => tag.label)).toContain('nullable');

    expect(humanizeFactRedaction('HASH', 'en-US')).toBe('Hashed');
    expect(resolveFactGroup(makeFact({ path: 'neighborhood.items', label: 'items' }), 'en-US', 'business').label).toBe(
      'Related records & history'
    );
  });

  it('groups facts in deterministic domain order and supports explicit groupLabel v2 metadata', () => {
    const groups = groupFactsForDisplay(
      [
        makeFact({ path: 'neighborhood.items', label: 'neighborhood: items' }),
        makeFact({ path: 'actor.role', label: 'actor: role', groupLabel: 'Autoridade do solicitante' }),
        makeFact({ path: 'draft.startDate', label: 'draft: startDate' })
      ],
      'pt-BR',
      'business'
    );

    expect(groups.map(g => g.group.label)).toEqual([
      'Dados do registro',
      'Autoridade do solicitante',
      'Histórico e registros relacionados'
    ]);
  });
});
