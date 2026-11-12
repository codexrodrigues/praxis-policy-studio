import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PolicyStudioI18n } from '../../core/i18n';
import type { DecisionSummary } from './catalog.fixture';
import { RuleDecisionPlanDagComponent } from './rule-decision-plan-dag.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

function createDecision(overrides: Partial<DecisionSummary> = {}): DecisionSummary {
  return {
    order: 1,
    totalDecisions: 2,
    key: 'rn013.qtd_max_limit',
    code: 'ERG-08390',
    name: 'Limite de quantidade máxima',
    domain: 'administracao-pessoal',
    ruleSet: 'RN-013 Regras de Frequência',
    ruleSetKey: 'ergon.administracao-pessoal.regras-frequencia.rn013',
    resourceKey: 'regras-frequencia',
    serviceKey: 'praxis-ergon-showcase',
    state: 'verified',
    meaning: 'Controla o teto parametrizável de quantidade máxima.',
    authority: 'Config · definição governada',
    baselineAuthority: 'ERGON_RULES_STUDIO_SEED',
    source: 'definition:1',
    evidenceCount: 1,
    authoringSupported: true,
    availableDefinitionActions: [],
    expression: 'draft.qtdMax <= 180',
    condition: { '<=': [{ var: 'draft.qtdMax' }, 180] },
    factPaths: ['draft.qtdMax', 'tenant.empCodigo'],
    facts: [],
    nullSemantics: 'FAIL_CLOSED',
    operationKeys: ['validate'],
    hostContractVersion: 'ergon-policy-studio/1.0',
    evidence: [],
    draftLifecycle: 'REFERENCE_DRAFT_ONLY',
    decisionStage: 'DOMAIN_DECISION',
    slotOverridePolicy: 'PARAMETERIZABLE',
    availableRoots: ['draft', 'tenant', 'context'],
    conceptRoots: ['codigoFrequencia', 'tipoFrequencia'],
    legacyOccurrence: {
      code: 'ERG-08390',
      targetField: 'qtdMax',
      plsqlOrigin: 'PCK_REGRAS_FREQ.MAIN_PRE',
      plsqlLineage: 'IF v_regras_freq.qtd_max > 180 THEN pack_hades.trata_erro(8390); END IF;'
    },
    ...overrides
  };
}

describe('RuleDecisionPlanDagComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [RuleDecisionPlanDagComponent],
      providers: [PolicyStudioI18n]
    });
  });

  it('renders the 5 canonical stages of DecisionStage, slot override policies, ontology roots, and PL/SQL lineage', () => {
    const fixture = TestBed.createComponent(RuleDecisionPlanDagComponent);
    const guardDecision = createDecision({
      key: 'rn013.guard_vigencia',
      code: 'ERG-08380',
      name: 'Guarda de vigência cronológica',
      decisionStage: 'PROTECTED_GUARD',
      slotOverridePolicy: 'FORBIDDEN',
      authoringSupported: false
    });
    const domainDecision = createDecision();

    fixture.componentInstance.selected = domainDecision;
    fixture.componentInstance.decisions = [guardDecision, domainDecision];
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-testid="rule-decision-plan-dag"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="dag-stage-PROTECTED_GUARD"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="dag-stage-PRE_CONDITION"]')).toBeNull();
    expect(host.querySelector('[data-testid="dag-stage-DOMAIN_DECISION"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="dag-stage-POST_DECISION"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="dag-stage-TRANSFORMATION_INTENT"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="dag-stage-EFFECT_INTENT"]')).toBeTruthy();

    const rootsBar = host.querySelector('[data-testid="dag-ontology-roots"]');
    expect(rootsBar?.textContent).toContain('draft');
    expect(rootsBar?.textContent).toContain('codigoFrequencia');

    const lineageCard = host.querySelector('[data-testid="dag-legacy-lineage"]');
    expect(lineageCard?.textContent).toContain('ERG-08390');
    expect(lineageCard?.textContent).toContain('PCK_REGRAS_FREQ.MAIN_PRE');

    const spy = vi.fn();
    fixture.componentInstance.decisionSelected.subscribe(spy);
    const guardButton = host.querySelector<HTMLButtonElement>('[data-testid="dag-node-rn013.guard_vigencia"]');
    expect(guardButton).toBeTruthy();
    guardButton?.click();
    expect(spy).toHaveBeenCalledWith(guardDecision);
  });

  it('projects simulation trace coloring, divergence badges, and 1-hop cross-RuleSet navigation', () => {
    const fixture = TestBed.createComponent(RuleDecisionPlanDagComponent);
    const domainDecision = createDecision({
      availableRoots: ['draft', 'vinculo'],
      conceptRoots: ['vinculo']
    });
    const neighborDecision = createDecision({
      key: 'ferias.vinculo_ativo',
      code: 'ERG-04110',
      name: 'Vínculo ativo para férias',
      ruleSetKey: 'ergon.administracao-pessoal.ferias.rn004',
      availableRoots: ['draft', 'vinculo'],
      conceptRoots: ['vinculo']
    });

    fixture.componentInstance.selected = domainDecision;
    fixture.componentInstance.decisions = [domainDecision, neighborDecision];
    fixture.componentInstance.sandboxRun = {
      runId: 'run-trace-1',
      workspaceId: 'ws-1',
      workspaceRevision: 2,
      evaluatedAtUtc: '2026-08-18T12:00:00Z',
      activeSnapshotKey: 'snap-1',
      results: [{
        scenarioId: 'sc-1',
        scenarioKey: 'excede-teto',
        expectedDecision: 'DENY',
        candidateDecision: 'DENY',
        activeDecision: 'ALLOW',
        comparison: 'CANDIDATE_MISMATCH',
        candidateMatchesExpected: true,
        activeMatchesExpected: false,
        candidateReasonCodes: ['ERG-08390'],
        activeReasonCodes: []
      }]
    };
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const nodeButton = host.querySelector<HTMLElement>('[data-testid="dag-node-rn013.qtd_max_limit"]');
    expect(nodeButton?.getAttribute('data-trace-outcome')).toBe('DENY');

    const divergencePill = host.querySelector('[data-testid="dag-node-divergence-rn013.qtd_max_limit"]');
    expect(divergencePill?.textContent).toContain('ALLOW → DENY');

    const traceSummary = host.querySelector('[data-testid="dag-simulation-trace-summary"]');
    expect(traceSummary?.textContent).toContain('excede-teto');

    const rootSpy = vi.fn();
    const decisionSpy = vi.fn();
    fixture.componentInstance.conceptRootSelected.subscribe(rootSpy);
    fixture.componentInstance.decisionSelected.subscribe(decisionSpy);

    const conceptChip = host.querySelector<HTMLButtonElement>('[data-testid="dag-concept-chip-vinculo"]');
    expect(conceptChip).toBeTruthy();
    conceptChip?.click();
    expect(rootSpy).toHaveBeenCalledWith('vinculo');

    const neighborBtn = host.querySelector<HTMLButtonElement>('[data-testid="dag-neighbor-ferias.vinculo_ativo"]');
    expect(neighborBtn).toBeTruthy();
    neighborBtn?.click();
    expect(decisionSpy).toHaveBeenCalledWith(neighborDecision);
  });
});
