import '@angular/compiler';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import type { RuleBuilderConfig } from '@praxisui/visual-builder';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PolicyStudioI18n } from '../../core/i18n';
import { LocalDraftWorkspaceComponent } from './local-draft-workspace.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

const baseConfig: RuleBuilderConfig = {
  fieldSchemas: {
    'draft.requestedAmount': {
      name: 'draft.requestedAmount',
      label: 'draft: requestedAmount',
      type: 'number',
      required: true,
      origin: 'field'
    },
    'draft.retroactiveDays': {
      name: 'draft.retroactiveDays',
      label: 'Dias retroativos',
      type: 'number',
      required: false,
      origin: 'field'
    }
  }
} as unknown as RuleBuilderConfig;

describe('LocalDraftWorkspaceComponent', () => {
  let fixture: ComponentFixture<LocalDraftWorkspaceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LocalDraftWorkspaceComponent, NoopAnimationsModule],
      providers: [PolicyStudioI18n]
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('renders humanized operators and clean fact labels in table mode when in business view and technical symbols in technical view', () => {
    fixture = TestBed.createComponent(LocalDraftWorkspaceComponent);
    fixture.componentRef.setInput('config', baseConfig);
    fixture.componentRef.setInput('condition', { '<=': [{ var: 'draft.requestedAmount' }, 3000] });
    fixture.componentRef.setInput('viewDepth', 'business');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const tableBtn = el.querySelector('[data-testid="representation-mode-table"]') as HTMLButtonElement;
    tableBtn.click();
    fixture.detectChanges();

    const factOptions = Array.from(el.querySelectorAll('[data-testid="decision-table-fact-0"] option')).map(o => o.textContent?.trim());
    expect(factOptions).toContain('Requested Amount');
    expect(factOptions.some(text => text?.includes('(draft.requestedAmount)'))).toBe(false);

    const operatorOptions = Array.from(el.querySelectorAll('[data-testid="decision-table-operator-0"] option')).map(o => o.textContent?.trim());
    expect(operatorOptions).toContain('menor ou igual a (≤)');

    fixture.componentRef.setInput('viewDepth', 'technical');
    fixture.detectChanges();

    const techFactOptions = Array.from(el.querySelectorAll('[data-testid="decision-table-fact-0"] option')).map(o => o.textContent?.trim());
    expect(techFactOptions).toContain('draft: requestedAmount (draft.requestedAmount)');

    const techOperatorOptions = Array.from(el.querySelectorAll('[data-testid="decision-table-operator-0"] option')).map(o => o.textContent?.trim());
    expect(techOperatorOptions[0]).toBe('<=');
  });

  it('formats substr and toNumber expressions in expression mode without emitting "?"', () => {
    fixture = TestBed.createComponent(LocalDraftWorkspaceComponent);
    fixture.componentRef.setInput('config', {
      fieldSchemas: {
        'draft.horaEntrada': { name: 'draft.horaEntrada', label: 'Hora Entrada', type: 'string', origin: 'field' },
        'draft.horaSaida': { name: 'draft.horaSaida', label: 'Hora Saída', type: 'string', origin: 'field' }
      }
    } as unknown as RuleBuilderConfig);
    fixture.componentRef.setInput('condition', {
      '>=': [
        { '+': [{ '*': [{ toNumber: [{ substr: [{ var: 'draft.horaSaida' }, 0, 2] }] }, 60] }, { toNumber: [{ substr: [{ var: 'draft.horaSaida' }, 3, 2] }] }] },
        { '+': [{ '*': [{ toNumber: [{ substr: [{ var: 'draft.horaEntrada' }, 0, 2] }] }, 60] }, { toNumber: [{ substr: [{ var: 'draft.horaEntrada' }, 3, 2] }] }] }
      ]
    });
    fixture.componentRef.setInput('viewDepth', 'business');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const exprBtn = el.querySelector('[data-testid="representation-mode-expression"]') as HTMLButtonElement;
    exprBtn.click();
    fixture.detectChanges();

    const exprText = el.querySelector('[data-testid="decision-domain-expression"]')?.textContent ?? '';
    expect(exprText).not.toContain('?');
    expect(exprText).toContain('minutos(Hora Saída) ≥ minutos(Hora Entrada)');
  });
});
