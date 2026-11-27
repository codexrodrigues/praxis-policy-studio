import { describe, expect, it } from 'vitest';
import type { DecisionSummary } from '../features/catalog/catalog.fixture';
import {
  buildCatalogPortfolioSummary,
  classifyDecisionWorkflowBucket,
  isAutonomyFilterReliable,
  isStageGroupingReliable
} from './catalog-portfolio';

function makeCatalogRule(
  index: number,
  overrides: Partial<DecisionSummary> = {}
): DecisionSummary {
  return {
    order: index,
    totalDecisions: 100,
    key: `workforce.rule.${index}`,
    code: `WF-${index}`,
    name: `Regra ${index}`,
    domain: 'human-resources.attendance',
    ruleSet: 'human-resources.attendance.launch',
    ruleSetKey: 'human-resources.attendance.launch',
    resourceKey: 'human-resources.attendance',
    serviceKey: 'workforce-service',
    state: 'verified',
    meaning: `Regra ${index}`,
    authority: 'CONFIG',
    baselineAuthority: 'SEED',
    source: 'catalog',
    evidenceCount: 0,
    authoringSupported: true,
    availableDefinitionActions: [],
    ruleType: 'validation',
    expression: null,
    condition: null,
    factPaths: [],
    facts: [],
    nullSemantics: null,
    operationKeys: [],
    hostContractVersion: null,
    evidence: [],
    draftLifecycle: null,
    ...overrides
  };
}

describe('catalog-portfolio', () => {
  it('detects partial hydration cleanly so global 1,006-rule catalogs never dump unhydrated rows into Other', () => {
    const partialCatalog = [
      ...Array.from({ length: 36 }, (_, idx) =>
        makeCatalogRule(idx + 1, {
          decisionStage: 'DOMAIN_DECISION',
          slotOverridePolicy: 'PARAMETERIZABLE'
        })
      ),
      ...Array.from({ length: 970 }, (_, idx) =>
        makeCatalogRule(idx + 37, {
          detailHydrated: false,
          decisionStage: undefined,
          slotOverridePolicy: undefined
        })
      )
    ];

    expect(isStageGroupingReliable(partialCatalog)).toBe(false);
    expect(isAutonomyFilterReliable(partialCatalog)).toBe(false);

    const hydratedScope = partialCatalog.slice(0, 17);
    expect(isStageGroupingReliable(hydratedScope)).toBe(true);
    expect(isAutonomyFilterReliable(hydratedScope)).toBe(true);
    expect(isStageGroupingReliable([])).toBe(false);
    expect(isAutonomyFilterReliable([])).toBe(false);
  });

  it('aggregates domains, functionalities, rule types, and prioritized governance queue across all catalog rows', () => {
    const decisions = [
      makeCatalogRule(1, {
        domain: 'human-resources.attendance',
        ruleSet: 'human-resources.attendance.launch',
        ruleSetKey: 'workforce.attendance.launch',
        ruleType: 'validation',
        workspaceStatus: 'OPEN',
        name: 'Regra aberta'
      }),
      makeCatalogRule(2, {
        domain: 'human-resources.attendance',
        ruleSet: 'human-resources.attendance.launch',
        ruleSetKey: 'workforce.attendance.launch',
        ruleType: 'validation',
        workspaceStatus: 'SUBMITTED',
        name: 'Regra em revisão'
      }),
      makeCatalogRule(3, {
        domain: 'human-resources.attendance',
        ruleSet: 'human-resources.attendance.balance',
        ruleSetKey: 'workforce.attendance.balance',
        ruleType: 'determination',
        workspaceStatus: 'PROMOTED',
        name: 'Regra promovida'
      }),
      makeCatalogRule(4, {
        domain: 'payroll.benefits',
        ruleSet: 'payroll.benefits.eligibility',
        ruleSetKey: 'payroll.benefits.eligibility',
        ruleType: 'approval_policy',
        workspaceStatus: 'REJECTED',
        name: 'Regra rejeitada'
      })
    ];

    expect(classifyDecisionWorkflowBucket(decisions[0]!)).toBe('OPEN');
    expect(classifyDecisionWorkflowBucket(decisions[1]!)).toBe('SUBMITTED');
    expect(classifyDecisionWorkflowBucket(decisions[2]!)).toBe('STABLE');
    expect(classifyDecisionWorkflowBucket(decisions[3]!)).toBe('REJECTED');

    const summary = buildCatalogPortfolioSummary(decisions, 'pt-BR', 'business');
    expect(summary.totalRules).toBe(4);
    expect(summary.domainCount).toBe(2);
    expect(summary.functionalityCount).toBe(3);

    expect(summary.activeWorkflowDecisions.map(item => item.workspaceStatus)).toEqual([
      'SUBMITTED',
      'OPEN',
      'REJECTED'
    ]);

    expect(summary.domains[0]).toMatchObject({
      domainKey: 'human-resources.attendance',
      label: 'Human Resources · Attendance',
      totalCount: 3,
      activeWorkCount: 2
    });
    expect(summary.domains[0]!.functionalities[0]).toMatchObject({
      scopeKey: 'workforce.attendance.launch',
      label: 'Attendance · Launch',
      count: 2,
      activeWorkCount: 2
    });

    expect(summary.ruleTypes[0]).toMatchObject({
      ruleType: 'validation',
      label: 'Validação',
      count: 2,
      percentage: 50
    });

    const labeledDecisions: DecisionSummary[] = [
      makeCatalogRule(10, {
        domain: 'administracao-pessoal',
        domainLabel: 'Férias e Prescrição',
        ruleSet: 'ergon.administracao-pessoal.ferias-gozo.operacional.guardas',
        ruleSetLabel: 'Guardas operacionais de concessão de férias',
        ruleSetKey: 'ergon.administracao-pessoal.ferias-gozo.operacional.guardas',
        name: 'Vínculo funcional'
      })
    ];
    const labeledBusiness = buildCatalogPortfolioSummary(labeledDecisions, 'pt-BR', 'business');
    expect(labeledBusiness.domains[0]).toMatchObject({
      domainKey: 'administracao-pessoal',
      label: 'Férias e Prescrição'
    });
    expect(labeledBusiness.domains[0]!.functionalities[0]).toMatchObject({
      scopeKey: 'ergon.administracao-pessoal.ferias-gozo.operacional.guardas',
      label: 'Guardas operacionais de concessão de férias'
    });
    const labeledTechnical = buildCatalogPortfolioSummary(labeledDecisions, 'pt-BR', 'technical');
    expect(labeledTechnical.domains[0]?.label).toBe('administracao-pessoal');
    expect(labeledTechnical.domains[0]!.functionalities[0]?.label).toBe(
      'ergon.administracao-pessoal.ferias-gozo.operacional.guardas'
    );
  });
});
