import '@angular/compiler';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PolicyStudioI18n } from '../../core/i18n';
import type { DecisionSummary } from './catalog.fixture';
import { CatalogPortfolioOverviewComponent } from './catalog-portfolio-overview.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

function makeDecision(index: number, overrides: Partial<DecisionSummary> = {}): DecisionSummary {
  return {
    order: index,
    totalDecisions: 4,
    key: `workforce.rule.${index}`,
    code: `WF-${index}`,
    name: `Regra ${index}`,
    domain: 'human-resources.attendance',
    ruleSet: 'human-resources.attendance.launch',
    ruleSetKey: 'workforce.attendance.launch',
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

describe('CatalogPortfolioOverviewComponent', () => {
  let fixture: ComponentFixture<CatalogPortfolioOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CatalogPortfolioOverviewComponent],
      providers: [PolicyStudioI18n]
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('renders KPIs, active workflow queue, domain drill-down and rule-type tab interactions', () => {
    const decisions = [
      makeDecision(1, { workspaceStatus: 'SUBMITTED', ruleType: 'validation' }),
      makeDecision(2, { workspaceStatus: 'OPEN', ruleType: 'validation' }),
      makeDecision(3, {
        domain: 'payroll.benefits',
        ruleSet: 'payroll.benefits.eligibility',
        ruleSetKey: 'payroll.benefits.eligibility',
        ruleType: 'approval_policy'
      })
    ];

    fixture = TestBed.createComponent(CatalogPortfolioOverviewComponent);
    fixture.componentRef.setInput('decisions', decisions);
    fixture.componentRef.setInput('selected', decisions[0]);
    fixture.componentRef.setInput('viewDepth', 'business');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="portfolio-kpi-total"]')?.textContent).toContain('3');
    expect(el.querySelector('[data-testid="portfolio-kpi-domains"]')?.textContent).toContain('2');
    expect(el.querySelector('[data-testid="portfolio-kpi-functionalities"]')?.textContent).toContain('2');
    expect(el.querySelector('[data-testid="portfolio-kpi-active-work"]')?.textContent).toContain('2');
    expect(el.querySelector('[data-testid="portfolio-active-queue"]')).not.toBeNull();

    const scopeSpy = vi.fn();
    const typeSpy = vi.fn();
    const decisionSpy = vi.fn();
    fixture.componentInstance.scopeSelected.subscribe(scopeSpy);
    fixture.componentInstance.ruleTypeSelected.subscribe(typeSpy);
    fixture.componentInstance.decisionSelected.subscribe(decisionSpy);

    const queueItem = fixture.debugElement.query(By.css('[data-testid="portfolio-queue-item-workforce.rule.1"]')).nativeElement as HTMLButtonElement;
    queueItem.click();
    expect(decisionSpy).toHaveBeenCalledWith(decisions[0]);

    const funcBtn = fixture.debugElement.query(By.css('[data-testid="portfolio-func-workforce.attendance.launch"]')).nativeElement as HTMLButtonElement;
    funcBtn.click();
    expect(scopeSpy).toHaveBeenCalledWith('workforce.attendance.launch');

    const typesTab = fixture.debugElement.query(By.css('[data-testid="portfolio-tab-types"]')).nativeElement as HTMLButtonElement;
    typesTab.click();
    fixture.detectChanges();

    const approvalCard = fixture.debugElement.query(By.css('[data-testid="portfolio-type-approval_policy"]')).nativeElement as HTMLButtonElement;
    approvalCard.click();
    expect(typeSpy).toHaveBeenCalledWith('approval_policy');
  });

  it('hides redundant 1:1 functionalities, offers domain search (>12 domains), and enriches single-rule-type view', () => {
    const manyDecisions: DecisionSummary[] = Array.from({ length: 14 }, (_, idx) =>
      makeDecision(idx + 1, {
        key: `domain-${idx}`,
        name: `Domain ${idx}`,
        domain: `Area ${idx}`,
        ruleSet: `Area ${idx}`,
        ruleSetKey: `area.${idx}`,
        ruleType: 'validation'
      })
    );

    fixture = TestBed.createComponent(CatalogPortfolioOverviewComponent);
    fixture.componentRef.setInput('decisions', manyDecisions);
    fixture.componentRef.setInput('viewDepth', 'business');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    // All 14 areas have single 1:1 functionality matching domain label -> .functionality-list omitted
    expect(el.querySelectorAll('.functionality-list')).toHaveLength(0);

    const sampleDomain = {
      domainKey: 'pessoal.pensoes',
      label: 'Administração Pessoal · Pensões Cotas Previdenciárias',
      totalCount: 37,
      activeWorkCount: 0,
      functionalities: []
    };
    expect(
      fixture.componentInstance.displayFunctionalityLabel(
        sampleDomain,
        'Pensões Cotas Previdenciárias · Previdência'
      )
    ).toBe('Previdência');
    expect(
      fixture.componentInstance.displayFunctionalityLabel(
        sampleDomain,
        'Pensões Cotas Previdenciárias'
      )
    ).toBe('Pensões Cotas Previdenciárias');

    const search = el.querySelector<HTMLInputElement>('[data-testid="portfolio-domain-search"]');
    expect(search).toBeTruthy();
    search!.value = 'Area 13';
    search!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.querySelectorAll('.domain-card')).toHaveLength(1);

    const typesTab = el.querySelector<HTMLButtonElement>('[data-testid="portfolio-tab-types"]');
    typesTab?.click();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="portfolio-single-type-context"]')).toBeTruthy();
  });
});
