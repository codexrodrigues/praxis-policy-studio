import { describe, expect, it } from 'vitest';
import {
  formatFactDisplayLabel,
  formatFactPopoverModel,
  groupFactsForDisplay,
  humanizeComplianceTag,
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

    const dotPrefixedOperation = makeFact({ path: 'context.operation', label: 'context.operation' });
    expect(formatFactDisplayLabel(dotPrefixedOperation, 'pt-BR', 'business')).toBe('Operação');
    expect(formatFactDisplayLabel(dotPrefixedOperation, 'en-US', 'business')).toBe('Operation');
    expect(formatFactDisplayLabel(dotPrefixedOperation, 'pt-BR', 'technical')).toBe('context.operation');

    const middleDotPrefixed = makeFact({ path: 'context.operation', label: 'Context · Operation' });
    expect(formatFactDisplayLabel(middleDotPrefixed, 'pt-BR', 'business')).toBe('Operação');

    const dotPrefixedValidation = makeFact({ path: 'context.cpfValido', label: 'context.cpfValido' });
    expect(formatFactDisplayLabel(dotPrefixedValidation, 'pt-BR', 'business')).toBe('CPF Válido');

    const dotPrefixedCount = makeFact({
      path: 'neighborhood.concomitanciaRegistroCount',
      label: 'neighborhood.concomitanciaRegistroCount'
    });
    expect(formatFactDisplayLabel(dotPrefixedCount, 'pt-BR', 'business')).toBe(
      'Concomitância Registro (Quantidade)'
    );
    expect(formatFactDisplayLabel(dotPrefixedCount, 'pt-BR', 'technical')).toBe(
      'neighborhood.concomitanciaRegistroCount'
    );
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

  it('consumes groupKey boilerplate fallbacks presentation constraints allowedValues lookup and aiVisibility deny safely', () => {
    const richCurrencyFact = makeFact({
      path: 'request.requestedAmount',
      valueType: 'number',
      nullable: false,
      label: 'Valor solicitado',
      description: 'Fato governado do RuleSet grant.amount (request.requestedAmount).',
      hint: 'Valor sem acréscimos.',
      groupKey: 'valores-orcamento',
      groupLabel: 'Valores e orçamento',
      unit: 'BRL',
      valuePresentation: 'currency',
      constraints: { min: 10, max: 5000, step: 0.01 }
    });
    const popover = formatFactPopoverModel(richCurrencyFact, 'pt-BR', 'business');
    expect(popover.group.key).toBe('valores-orcamento');
    expect(popover.group.label).toBe('Valores e orçamento');
    expect(popover.summary).toBe('Informação consultada em Valores e orçamento durante a avaliação desta regra.');
    expect(popover.hint).toBe('Valor sem acréscimos.');
    expect(popover.metaTags.map(t => t.label)).toContain('Monetário');
    expect(popover.metaTags.map(t => t.label)).toContain('Faixa: 10 a 5000');

    const statusFact = makeFact({
      path: 'worker.status',
      valueType: 'string',
      nullable: false,
      label: 'Situação',
      description: 'Situação do vínculo.',
      allowedValues: [
        { value: 'ACTIVE', label: 'Ativo' },
        { value: 'ON_LEAVE', label: 'Afastado' }
      ],
      optionSourceRef: { sourceKey: 'worker-statuses', resourceKey: 'workforce.statuses' },
      governance: { aiVisibility: 'deny' }
    });
    const statusPopover = formatFactPopoverModel(statusFact, 'pt-BR', 'business');
    expect(statusPopover.metaTags.map(t => t.label)).toContain('Opções: Ativo, Afastado');
    expect(statusPopover.metaTags.map(t => t.label)).toContain('Catálogo dinâmico');
    expect(statusPopover.metaTags.map(t => t.label)).toContain('IA vedada');
  });

  it('surfaces standalone length/step/pattern constraints, mask, governance compliance tags, technical lineage, and dedups hints', () => {
    const richFact = makeFact({
      path: 'actor.cpf',
      valueType: 'string',
      nullable: false,
      label: 'CPF',
      description: 'Documento cadastral.',
      hint: 'Documento cadastral.',
      mask: '000.000.000-00',
      constraints: { maxLength: 14, pattern: '^\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}$' },
      governance: {
        classification: 'restricted',
        exportable: false,
        aiVisibility: 'mask',
        complianceTags: ['LGPD_ART_5_I', 'LAI']
      },
      optionSourceRef: { sourceKey: 'actors', resourceKey: 'hr.actors' },
      lineage: { attributeId: 'actor.cpf', sourceResourceKey: 'hr.actors', transformation: 'MASKED' },
      sensitivity: 'SENSITIVE',
      redaction: 'MASK'
    });

    const businessPopover = formatFactPopoverModel(richFact, 'pt-BR', 'business');
    expect(businessPopover.hint).toBeNull();
    const businessLabels = businessPopover.metaTags.map(t => t.label);
    expect(businessLabels).toContain('Máx. 14 caracteres');
    expect(businessLabels).toContain('Formato validado');
    expect(businessLabels).toContain('Máscara: 000.000.000-00');
    expect(businessLabels).toContain('Restrito');
    expect(businessLabels).toContain('IA mascarada');
    expect(businessLabels).toContain('Exportação bloqueada');
    expect(businessLabels).toContain('LGPD_ART_5_I');
    expect(businessLabels).toContain('LAI');
    expect(businessLabels).toContain('Catálogo dinâmico');

    const techPopover = formatFactPopoverModel(richFact, 'pt-BR', 'technical');
    expect(techPopover.detail).toContain('Lineage: hr.actors · actor.cpf · (MASKED)');
    expect(techPopover.detail).toContain('Lookup: actors · hr.actors');
    expect(techPopover.metaTags.map(t => t.label).some(l => l.startsWith('Padrão: '))).toBe(true);
  });

  it('localizes generic compliance policy enums while keeping legal citations intact', () => {
    expect(humanizeComplianceTag('COMPLIANCE', 'pt-BR')).toBe('Conformidade');
    expect(humanizeComplianceTag('INTERNAL_POLICY', 'pt-BR')).toBe('Política interna');
    expect(humanizeComplianceTag('REGULATORY', 'en-US')).toBe('Regulatory');
    expect(humanizeComplianceTag('PUBLIC_TRANSPARENCY', 'pt-BR')).toBe('Transparência pública');
    expect(humanizeComplianceTag('PUBLIC_TRANSPARENCY', 'en-US')).toBe('Public transparency');
    expect(humanizeComplianceTag('PUBLIC_TRANSPARENCY_REMUNERATION', 'pt-BR')).toBe('Transparência remuneratória');
    expect(humanizeComplianceTag('PUBLIC_TRANSPARENCY_REMUNERATION', 'en-US')).toBe('Public remuneration transparency');
    expect(humanizeComplianceTag('LGPD_ART_5_I', 'pt-BR')).toBe('LGPD_ART_5_I');
    expect(humanizeComplianceTag('LAI', 'pt-BR')).toBe('LAI');
  });
});
