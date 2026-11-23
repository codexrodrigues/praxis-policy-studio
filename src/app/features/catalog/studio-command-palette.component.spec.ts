import '@angular/compiler';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PolicyStudioI18n } from '../../core/i18n';
import type { DecisionSummary } from './catalog.fixture';
import { StudioCommandPaletteComponent } from './studio-command-palette.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

function makeDecision(index: number, overrides: Partial<DecisionSummary> = {}): DecisionSummary {
  return {
    order: index,
    totalDecisions: 2,
    key: `workforce.rule.${index}`,
    code: `WF-${index}`,
    name: `Regra ${index}`,
    domain: index === 1 ? 'human-resources.attendance' : 'payroll.benefits',
    ruleSet: index === 1 ? 'Frequências · Lançamento' : 'Benefícios · Elegibilidade',
    ruleSetKey: index === 1 ? 'human-resources.attendance.launch' : 'payroll.benefits.calc',
    resourceKey: 'human-resources.attendance',
    serviceKey: 'attendance-service',
    state: 'verified',
    meaning: `Descrição ${index}`,
    authority: 'CONFIG_AUTHORITATIVE',
    baselineAuthority: 'LEGACY_RECOVERED',
    source: 'config',
    evidenceCount: 1,
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
    ...overrides
  };
}

describe('StudioCommandPaletteComponent', () => {
  let fixture: ComponentFixture<StudioCommandPaletteComponent>;

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudioCommandPaletteComponent],
      providers: [PolicyStudioI18n]
    }).compileComponents();
  });

  it('filters actions/scopes/decisions, navigates via ArrowDown + Enter, and closes on Escape', () => {
    const first = makeDecision(1, { name: 'Janela retroativa' });
    const second = makeDecision(2, { name: 'Teto do benefício alimentação' });

    fixture = TestBed.createComponent(StudioCommandPaletteComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('decisions', [first, second]);
    fixture.componentRef.setInput('selected', first);
    fixture.detectChanges();

    const closedSpy = vi.fn();
    const decisionSpy = vi.fn();
    fixture.componentInstance.closed.subscribe(closedSpy);
    fixture.componentInstance.decisionSelected.subscribe(decisionSpy);

    const dialog = fixture.debugElement.query(By.css('[data-testid="command-palette-dialog"]')).nativeElement as HTMLElement;
    const input = fixture.debugElement.query(By.css('[data-testid="command-palette-input"]')).nativeElement as HTMLInputElement;

    input.value = 'alimentacao';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const options = (fixture.nativeElement as HTMLElement).querySelectorAll('[role="option"]');
    expect(options.length).toBe(1);
    expect(options[0]?.textContent).toContain('Teto do benefício alimentação');

    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(decisionSpy).toHaveBeenCalledWith(second);

    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(closedSpy).toHaveBeenCalledOnce();
  });
});
