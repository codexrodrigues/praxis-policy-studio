import '@angular/compiler';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PolicyStudioI18n } from '../../core/i18n';
import type { DecisionSummary } from './catalog.fixture';
import { EvaluatedFactsPanelComponent } from './evaluated-facts-panel.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

function makeDecision(overrides: Partial<DecisionSummary> = {}): DecisionSummary {
  return {
    order: 1,
    totalDecisions: 1,
    key: 'benefits.limit-check',
    code: 'BEN-01',
    name: 'Limite do benefício',
    domain: 'benefits',
    ruleSet: 'Benefits · Request',
    ruleSetKey: 'benefits.request',
    resourceKey: 'benefits.requests',
    serviceKey: 'benefits-service',
    state: 'verified',
    meaning: 'Valida o teto solicitado.',
    authority: 'CONFIG',
    baselineAuthority: 'CATALOG',
    source: 'definition:1',
    evidenceCount: 0,
    authoringSupported: true,
    availableDefinitionActions: [],
    expression: 'request.amount <= employee.salaryCap',
    condition: { '<=': [{ var: 'request.amount' }, { var: 'employee.salaryCap' }] },
    factPaths: ['request.amount', 'employee.salaryCap', 'neighborhood.priorRequests'],
    evaluatedFactPaths: ['request.amount', 'employee.salaryCap'],
    facts: [
      {
        path: 'request.amount',
        valueType: 'number',
        nullable: false,
        label: 'Valor solicitado',
        description: 'Valor informado na solicitação. Orientação operacional: Deve ser maior que zero.',
        providerRef: 'benefits',
        evidenceRefs: [],
        sensitivity: 'NON_SENSITIVE',
        redaction: 'NONE'
      },
      {
        path: 'employee.salaryCap',
        valueType: 'number',
        nullable: true,
        label: 'employee: tetoSalarial',
        description: 'Teto aplicável ao servidor.',
        providerRef: 'workforce',
        evidenceRefs: [],
        sensitivity: 'PERSONAL',
        redaction: 'MASK'
      },
      {
        path: 'neighborhood.priorRequests',
        valueType: 'string-array',
        nullable: true,
        label: 'neighborhood: solicitacoesAnteriores',
        description: 'Fato de avaliação do RuleSet benefits.request (neighborhood.priorRequests).',
        providerRef: 'benefits',
        evidenceRefs: [],
        sensitivity: 'NON_SENSITIVE',
        redaction: 'NONE'
      }
    ],
    nullSemantics: 'FAIL_CLOSED',
    operationKeys: ['CREATE'],
    hostContractVersion: '1.0',
    evidence: [],
    draftLifecycle: null,
    ...overrides
  };
}

describe('EvaluatedFactsPanelComponent', () => {
  let fixture: ComponentFixture<EvaluatedFactsPanelComponent>;

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EvaluatedFactsPanelComponent],
      providers: [PolicyStudioI18n]
    }).compileComponents();
  });

  it('displays only rule-scoped facts by default grouped by origin and reveals remaining catalog facts on toggle', () => {
    fixture = TestBed.createComponent(EvaluatedFactsPanelComponent);
    fixture.componentRef.setInput('decision', makeDecision());
    fixture.componentRef.setInput('parameters', []);
    fixture.componentRef.setInput('viewDepth', 'business');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-testid="evaluated-facts-scope-badge"]')?.textContent).toContain(
      '2 de 3 dados da operação'
    );
    expect(host.querySelector('[data-testid="evaluated-fact-groups"]')).toBeTruthy();
    expect(host.textContent).toContain('Valor solicitado');
    expect(host.textContent).toContain('Teto Salarial');
    expect(host.textContent).not.toContain('Solicitacoes Anteriores');
    expect(host.querySelector('[data-testid="evaluated-facts-catalog-panel"]')).toBeNull();

    const firstTrigger = fixture.debugElement.queryAll(By.css('.pax-term-trigger'))[1]!.nativeElement as HTMLButtonElement;
    firstTrigger.click();
    fixture.detectChanges();
    const card = host.querySelector('.pax-term-card') as HTMLElement;
    expect(card.textContent).toContain('Opcional');
    expect(card.textContent).not.toContain('nullable');
    expect(card.textContent).not.toContain('Path:');
    firstTrigger.click();
    fixture.detectChanges();

    const catalogToggle = host.querySelector('[data-testid="evaluated-facts-catalog-toggle"]') as HTMLButtonElement;
    expect(catalogToggle.textContent).toContain('Ver outros 1 dados disponíveis na operação');
    catalogToggle.click();
    fixture.detectChanges();

    expect(host.querySelector('[data-testid="evaluated-facts-catalog-panel"]')).toBeTruthy();

    fixture.componentRef.setInput('decision', makeDecision({ key: 'benefits.other-rule' }));
    fixture.detectChanges();
    expect(host.querySelector('[data-testid="evaluated-facts-catalog-panel"]')).toBeNull();
  });
});
