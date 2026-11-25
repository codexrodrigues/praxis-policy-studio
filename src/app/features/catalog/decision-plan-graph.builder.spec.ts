import { describe, expect, it } from 'vitest';
import type { DecisionSummary } from './catalog.fixture';
import { buildDecisionPlanGraph } from './decision-plan-graph.builder';
import type { DagStageLane } from './rule-decision-plan-dag.component';

function makeDecision(overrides: Partial<DecisionSummary> = {}): DecisionSummary {
  return {
    order: 1,
    totalDecisions: 1,
    key: 'workforce.benefit.guard-eligibility',
    code: 'WF-00010',
    name: 'Verifica elegibilidade básica do beneficiário',
    domain: 'benefits',
    ruleSet: 'Benefits · Quota Rules',
    ruleSetKey: 'workforce.benefits.quotas',
    resourceKey: 'benefits-quotas',
    serviceKey: 'praxis-api-quickstart',
    state: 'verified',
    meaning: 'Exige cadastro válido.',
    authority: 'Config',
    baselineAuthority: 'WORKFORCE_RULES_STUDIO_SEED',
    source: 'definition:1',
    evidenceCount: 1,
    authoringSupported: false,
    availableDefinitionActions: [],
    expression: 'draft.active === true && actor.cpf != null',
    condition: {
      and: [
        { '===': [{ var: 'draft.active' }, true] },
        { '!=': [{ var: 'actor.cpf' }, null] }
      ]
    },
    factPaths: ['draft.active', 'actor.cpf'],
    facts: [
      {
        path: 'draft.active',
        label: 'Vínculo ativo',
        valueType: 'boolean',
        nullable: false,
        description: '',
        providerRef: 'host',
        evidenceRefs: [],
        sensitivity: 'NON_SENSITIVE',
        redaction: 'NONE'
      },
      {
        path: 'actor.cpf',
        label: 'CPF do beneficiário',
        valueType: 'string',
        nullable: false,
        description: '',
        providerRef: 'host',
        evidenceRefs: [],
        sensitivity: 'PERSONAL',
        redaction: 'MASK'
      }
    ],
    nullSemantics: 'FAIL_CLOSED',
    operationKeys: ['CREATE'],
    hostContractVersion: '1.0',
    evidence: [],
    draftLifecycle: null,
    decisionStage: 'PROTECTED_GUARD',
    slotOverridePolicy: 'FORBIDDEN',
    ...overrides
  };
}

function makeLanes(guard: DecisionSummary, domainRules: readonly DecisionSummary[]): readonly DagStageLane[] {
  return [
    {
      id: 'PROTECTED_GUARD',
      index: 1,
      codeLabel: '01 · GUARD',
      titlePtBr: 'Pré-requisitos obrigatórios',
      titleEnUs: 'Required prerequisites',
      shortTitlePtBr: 'Pré-req.',
      shortTitleEnUs: 'Guards',
      purposeKey: 'dagStagePurposeGuard',
      decisions: [guard]
    },
    {
      id: 'DOMAIN_DECISION',
      index: 2,
      codeLabel: '02 · DOMAIN',
      titlePtBr: 'Regras de negócio',
      titleEnUs: 'Business rules',
      shortTitlePtBr: 'Negócio',
      shortTitleEnUs: 'Business',
      purposeKey: 'dagStagePurposeDomain',
      decisions: domainRules
    },
    {
      id: 'POST_DECISION',
      index: 3,
      codeLabel: '03 · POST',
      titlePtBr: 'Validações cruzadas',
      titleEnUs: 'Cross-validations',
      shortTitlePtBr: 'Cruzadas',
      shortTitleEnUs: 'Cross',
      purposeKey: 'dagStagePurposePost',
      decisions: []
    },
    {
      id: 'TRANSFORMATION_INTENT',
      index: 4,
      codeLabel: '04 · TRANSFORM',
      titlePtBr: 'Ajustes automáticos',
      titleEnUs: 'Automatic adjustments',
      shortTitlePtBr: 'Ajustes',
      shortTitleEnUs: 'Adjust',
      purposeKey: 'dagStagePurposeTransform',
      decisions: []
    },
    {
      id: 'EFFECT_INTENT',
      index: 5,
      codeLabel: '05 · EFFECT',
      titlePtBr: 'Consequências e registros',
      titleEnUs: 'Consequences and records',
      shortTitlePtBr: 'Efeitos',
      shortTitleEnUs: 'Effects',
      purposeKey: 'dagStagePurposeEffect',
      decisions: []
    }
  ];
}

describe('decision-plan-graph.builder', () => {
  const resolvePolicy = (item: DecisionSummary) => item.slotOverridePolicy ?? 'FORBIDDEN';
  const policyLabel = (policy: string) =>
    policy === 'FORBIDDEN' ? 'Fixa' : policy === 'PARAMETERIZABLE' ? 'Parametrizável' : 'Customizável';

  it('builds a layered-dag flow with fail-closed guard branch, dense stage autonomy buckets, and bypass pill', () => {
    const guard = makeDecision();
    const domainRules = [
      ...Array.from({ length: 3 }, (_, idx) =>
        makeDecision({
          key: `domain.fixed.${idx}`,
          code: `WF-10${idx}`,
          name: `Regra fixa ${idx}`,
          decisionStage: 'DOMAIN_DECISION',
          slotOverridePolicy: 'FORBIDDEN'
        })
      ),
      ...Array.from({ length: 2 }, (_, idx) =>
        makeDecision({
          key: `domain.param.${idx}`,
          code: `WF-20${idx}`,
          name: `Regra param ${idx}`,
          decisionStage: 'DOMAIN_DECISION',
          slotOverridePolicy: 'PARAMETERIZABLE'
        })
      ),
      makeDecision({
        key: 'domain.custom.0',
        code: 'WF-300',
        name: 'Regra customizável',
        decisionStage: 'DOMAIN_DECISION',
        slotOverridePolicy: 'REPLACEABLE'
      })
    ];

    const built = buildDecisionPlanGraph({
      selectedDecision: guard,
      lanes: makeLanes(guard, domainRules),
      viewDepth: 'business',
      locale: 'pt-BR',
      graphLens: 'flow',
      traceOverview: null,
      nodeTrace: () => null,
      resolveOverridePolicy: resolvePolicy,
      overridePolicyLabel: policyLabel,
      displayNodeTitle: item => item.name,
      conceptNeighborGroups: []
    });

    expect(built.config.layout?.algorithm).toBe('layered-dag');
    expect(built.config.title).toBeUndefined();
    expect(built.config.layout?.showInspector).toBe(false);
    expect(built.config.layout?.showTableToggle).toBe(false);
    expect(built.config.appearance?.tokens?.['--prx-rg-text']).toBe('var(--pax-color-on-surface)');

    const nodes = built.dataset.nodes as Array<{
      id: string;
      label?: string;
      attributes?: Record<string, unknown>;
      raw?: Record<string, unknown>;
    }>;
    const edges = built.dataset.edges as Array<{ id: string; relation?: string; evidence?: string }>;
    expect(nodes.some(n => n.id === 'node:entry')).toBe(true);
    expect(nodes.find(n => n.id === `rule:${guard.key}`)?.attributes).toEqual({
      decisionKey: guard.key,
      stageId: 'PROTECTED_GUARD'
    });
    expect(nodes.some(n => n.id === 'node:blocked')).toBe(true);
    expect(nodes.some(n => n.id === 'node:approved')).toBe(true);
    expect(nodes.find(n => n.id === 'bucket:DOMAIN_DECISION:fixed')?.label).toBe('3 regras fixas');
    expect(nodes.find(n => n.id === 'bucket:DOMAIN_DECISION:parameterizable')?.label).toBe('2 regras parametrizáveis');
    expect(nodes.find(n => n.id === 'bucket:DOMAIN_DECISION:parameterizable')?.attributes).toEqual({
      jumpStageId: 'DOMAIN_DECISION'
    });
    expect(nodes.find(n => n.id === 'bucket:DOMAIN_DECISION:customizable')?.label).toBe('1 regra customizável');
    expect(nodes.find(n => n.id === 'node:bypass:3-5')?.label).toContain('Etapas 03–05 · Passagem direta');
    expect(edges.some(e => e.relation === 'Inicia' && e.evidence === 'observed')).toBe(true);
    expect(edges.some(e => e.relation === 'Sem regras' && e.evidence === 'inferred')).toBe(true);
    expect(built.pathHighlight).toBeNull();
  });

  it('keeps the selected rule explicit inside a dense stage while subtracting it from remaining buckets', () => {
    const guard = makeDecision();
    const selectedDomain = makeDecision({
      key: 'domain.selected',
      code: 'WF-299',
      name: 'Teto parametrizável selecionado',
      decisionStage: 'DOMAIN_DECISION',
      slotOverridePolicy: 'PARAMETERIZABLE'
    });
    const otherRules = Array.from({ length: 5 }, (_, idx) =>
      makeDecision({
        key: `domain.param.${idx}`,
        code: `WF-20${idx}`,
        name: `Outra regra ${idx}`,
        decisionStage: 'DOMAIN_DECISION',
        slotOverridePolicy: 'PARAMETERIZABLE'
      })
    );

    const built = buildDecisionPlanGraph({
      selectedDecision: selectedDomain,
      lanes: makeLanes(guard, [selectedDomain, ...otherRules]),
      viewDepth: 'business',
      locale: 'en-US',
      graphLens: 'flow',
      traceOverview: {
        candidateOutcome: 'DENY',
        activeOutcome: 'ALLOW',
        divergent: true,
        scenarioCount: 2,
        divergentScenarioKeys: ['exceeds-limit']
      },
      nodeTrace: item =>
        item.key === selectedDomain.key
          ? {
              candidateOutcome: 'DENY',
              activeOutcome: 'ALLOW',
              divergent: true,
              scenarioCount: 2,
              divergentScenarioKeys: ['exceeds-limit']
            }
          : null,
      resolveOverridePolicy: resolvePolicy,
      overridePolicyLabel: policyLabel,
      displayNodeTitle: item => item.name,
      conceptNeighborGroups: []
    });

    const nodes = built.dataset.nodes as Array<{ id: string; label?: string; tone?: string }>;
    const explicitSelected = nodes.find(n => n.id === 'rule:domain.selected');
    expect(explicitSelected).toBeTruthy();
    expect(explicitSelected?.tone).toBe('warning');
    expect(nodes.find(n => n.id === 'bucket:DOMAIN_DECISION:parameterizable')?.label).toBe(
      'Other 5 parameterizable rules'
    );
    expect(built.dataset.verdict?.tone).toBe('warning');
    expect(built.pathHighlight?.focusNodeId).toBe('rule:domain.selected');
  });

  it('builds an ego-radial impact map linking evaluated facts and 1-hop concept neighbors', () => {
    const guard = makeDecision();
    const neighbor = makeDecision({
      key: 'workforce.benefit.neighbor',
      code: 'WF-00022',
      name: 'Regra vizinha de acúmulo',
      ruleSetKey: 'workforce.benefits.accumulation',
      decisionStage: 'POST_DECISION'
    });

    const built = buildDecisionPlanGraph({
      selectedDecision: guard,
      lanes: makeLanes(guard, []),
      viewDepth: 'business',
      locale: 'pt-BR',
      graphLens: 'impact',
      traceOverview: null,
      nodeTrace: () => null,
      resolveOverridePolicy: resolvePolicy,
      overridePolicyLabel: policyLabel,
      displayNodeTitle: item => item.name,
      conceptNeighborGroups: [
        {
          root: 'beneficiarioCpf',
          isConceptRoot: true,
          neighborDecisions: [neighbor],
          distinctRuleSetKeys: ['workforce.benefits.accumulation']
        }
      ]
    });

    expect(built.config.layout?.algorithm).toBe('ego-radial');
    expect(built.config.layout?.anchorNodeId).toBe(`rule:${guard.key}`);
    expect(built.pathHighlight).toEqual({ focusNodeId: `rule:${guard.key}`, hops: 2 });

    const nodes = built.dataset.nodes as Array<{
      id: string;
      tone?: string;
      label?: string;
      attributes?: Record<string, unknown>;
    }>;
    expect(nodes.some(n => n.id === 'fact:draft.active')).toBe(true);
    expect(nodes.find(n => n.id === 'fact:actor.cpf')?.tone).toBe('warning');
    expect(nodes.find(n => n.id === 'concept:beneficiarioCpf')?.attributes).toEqual({
      conceptRoot: 'beneficiarioCpf'
    });
    expect(nodes.some(n => n.id === 'rule:workforce.benefit.neighbor')).toBe(true);
  });
});
