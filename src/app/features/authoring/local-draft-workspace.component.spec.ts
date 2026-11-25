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

  it('renders allowedValues dropdown with numeric coercion and currency formatting in table and expression modes', () => {
    fixture = TestBed.createComponent(LocalDraftWorkspaceComponent);
    const emitted: unknown[] = [];
    fixture.componentInstance.conditionChanged.subscribe(value => emitted.push(value));
    fixture.componentRef.setInput('config', {
      fieldSchemas: {
        'worker.tier': {
          name: 'worker.tier',
          label: 'Faixa salarial',
          type: 'number',
          origin: 'field',
          allowedValues: [
            { value: 1, label: 'Faixa I' },
            { value: 2, label: 'Faixa II' }
          ]
        }
      }
    } as unknown as RuleBuilderConfig);
    fixture.componentRef.setInput('condition', { '===': [{ var: 'worker.tier' }, 1] });
    fixture.componentRef.setInput('viewDepth', 'business');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('[data-testid="representation-mode-table"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const valueSelect = el.querySelector('select[data-testid="decision-table-value-0"]') as HTMLSelectElement;
    expect(valueSelect).toBeTruthy();
    expect(Array.from(valueSelect.options).map(o => o.textContent?.trim())).toEqual(['Faixa I', 'Faixa II']);
    valueSelect.value = '2';
    valueSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(emitted.at(-1)).toEqual({ '===': [{ var: 'worker.tier' }, 2] });
  });

  it('initializes new table clauses with first allowedValues option and shows disabled placeholder when rawValue is empty', () => {
    fixture = TestBed.createComponent(LocalDraftWorkspaceComponent);
    const emitted: unknown[] = [];
    fixture.componentInstance.conditionChanged.subscribe(value => emitted.push(value));
    fixture.componentRef.setInput('config', {
      fieldSchemas: {
        'worker.status': {
          name: 'worker.status',
          label: 'Situação',
          type: 'string',
          origin: 'field',
          allowedValues: [
            { value: 'ACTIVE', label: 'Ativo' },
            { value: 'INACTIVE', label: 'Inativo' }
          ]
        }
      }
    } as unknown as RuleBuilderConfig);
    fixture.componentRef.setInput('condition', null);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('[data-testid="representation-mode-table"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    (el.querySelector('[data-testid="decision-table-add-clause"]') as HTMLButtonElement).click();
    expect(emitted.at(-1)).toEqual({ '<=': [{ var: 'worker.status' }, 'ACTIVE'] });

    fixture.componentRef.setInput('condition', { '===': [{ var: 'worker.status' }, ''] });
    fixture.detectChanges();
    const selectEl = el.querySelector('select[data-testid="decision-table-value-0"]') as HTMLSelectElement;
    expect(selectEl.options[0]?.disabled).toBe(true);
    expect(selectEl.options[0]?.value).toBe('');
  });
});
