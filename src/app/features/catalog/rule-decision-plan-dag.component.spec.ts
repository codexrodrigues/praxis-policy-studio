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
    code: 'WF-08390',
    name: 'Limite de quantidade máxima',
    domain: 'human-resources',
    ruleSet: 'RN-013 Regras de Frequência',
    ruleSetKey: 'workforce.human-resources.attendance-rules.rn013',
    resourceKey: 'attendance-rules',
    serviceKey: 'praxis-api-quickstart',
    state: 'verified',
    meaning: 'Controla o teto parametrizável de quantidade máxima.',
    authority: 'Config · definição governada',
    baselineAuthority: 'WORKFORCE_RULES_STUDIO_SEED',
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
    hostContractVersion: 'workforce-policy-studio/1.0',
    evidence: [],
    draftLifecycle: 'REFERENCE_DRAFT_ONLY',
    decisionStage: 'DOMAIN_DECISION',
    slotOverridePolicy: 'PARAMETERIZABLE',
    availableRoots: ['draft', 'tenant', 'context'],
    conceptRoots: ['codigoFrequencia', 'tipoFrequencia'],
    legacyOccurrence: {
      code: 'WF-08390',
      targetField: 'qtdMax',
      plsqlOrigin: 'PKG_ATTENDANCE_RULES.MAIN_PRE',
      plsqlLineage: 'IF v_attendance_rules.qtd_max > 180 THEN pkg_legacy_rules.raise_error(8390); END IF;'
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

  it('renders the 5 canonical stages of DecisionStage, slot override policies, ontology roots, and legacy lineage', () => {
    const fixture = TestBed.createComponent(RuleDecisionPlanDagComponent);
    const guardDecision = createDecision({
      key: 'rn013.guard_vigencia',
      code: 'WF-08380',
      name: 'Guarda de vigência cronológica',
      decisionStage: 'PROTECTED_GUARD',
      slotOverridePolicy: 'FORBIDDEN',
      authoringSupported: false
    });
    const domainDecision = createDecision();

    fixture.componentInstance.selected = domainDecision;
    fixture.componentInstance.decisions = [guardDecision, domainDecision];
    fixture.componentInstance.viewDepth = 'technical';
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
    expect(lineageCard?.textContent).toContain('WF-08390');
    expect(lineageCard?.textContent).toContain('PKG_ATTENDANCE_RULES.MAIN_PRE');

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
      availableRoots: ['draft', 'employment'],
      conceptRoots: ['employment']
    });
    const neighborDecision = createDecision({
      key: 'leave.active_employment',
      code: 'WF-04110',
      name: 'Vínculo ativo para afastamento',
      ruleSetKey: 'workforce.human-resources.leave.rn004',
      availableRoots: ['draft', 'employment'],
      conceptRoots: ['employment']
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
        candidateReasonCodes: ['WF-08390'],
        activeReasonCodes: []
      }]
    };
    fixture.componentInstance.viewDepth = 'technical';
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

    const conceptChip = host.querySelector<HTMLButtonElement>('[data-testid="dag-concept-chip-employment"]');
    expect(conceptChip).toBeTruthy();
    conceptChip?.click();
    expect(rootSpy).toHaveBeenCalledWith('employment');

    const neighborBtn = host.querySelector<HTMLButtonElement>('[data-testid="dag-neighbor-leave.active_employment"]');
    expect(neighborBtn).toBeTruthy();
    neighborBtn?.click();
    expect(decisionSpy).toHaveBeenCalledWith(neighborDecision);
  });

  it('renders human stage titles in pt-BR/en-US and LOCKED override policy label', () => {
    const i18n = TestBed.inject(PolicyStudioI18n);
    const fixture = TestBed.createComponent(RuleDecisionPlanDagComponent);
    const lockedDecision = createDecision({
      key: 'workforce.guard.locked_rule',
      code: 'WF-00099',
      ruleSetKey: 'workforce.leave-requests',
      decisionStage: 'PROTECTED_GUARD',
      slotOverridePolicy: 'LOCKED',
      authoringSupported: false
    });

    fixture.componentInstance.selected = lockedDecision;
    fixture.componentInstance.decisions = [lockedDecision];
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-testid="dag-business-footer"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="dag-legacy-lineage"]')).toBeNull();
    expect(host.querySelector('[data-testid="dag-stage-PROTECTED_GUARD"]')?.textContent)
      .toContain('Pré-requisitos obrigatórios');
    expect(host.querySelector('[data-testid="dag-stage-DOMAIN_DECISION"]')?.textContent)
      .toContain('Regras de negócio');
    expect(host.querySelector('[data-testid="dag-stage-POST_DECISION"]')?.textContent)
      .toContain('Validações cruzadas');
    expect(host.querySelector('[data-testid="dag-stage-TRANSFORMATION_INTENT"]')?.textContent)
      .toContain('Ajustes automáticos');
    expect(host.querySelector('[data-testid="dag-stage-EFFECT_INTENT"]')?.textContent)
      .toContain('Consequências e registros');
    expect(host.querySelector('[data-testid="dag-node-workforce.guard.locked_rule"]')?.textContent)
      .toContain('Fixa');

    i18n.locale.set('en-US');
    fixture.detectChanges();
    expect(host.querySelector('[data-testid="dag-stage-PROTECTED_GUARD"]')?.textContent)
      .toContain('Required prerequisites');
    expect(host.querySelector('[data-testid="dag-node-workforce.guard.locked_rule"]')?.textContent)
      .toContain('Locked');

    fixture.componentInstance.viewDepth = 'technical';
    fixture.detectChanges();
    expect(host.querySelector('[data-testid="dag-node-workforce.guard.locked_rule"]')?.textContent)
      .toContain('GUARD · LOCKED');
    i18n.locale.set('pt-BR');
    fixture.detectChanges();
    expect(host.querySelector('[data-testid="dag-node-workforce.guard.locked_rule"]')?.textContent)
      .toContain('GUARD · BLOQUEADO');
  });
});
