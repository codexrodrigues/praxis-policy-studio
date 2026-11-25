import '@angular/compiler';
import { signal, ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PolicyStudioI18n } from '../../core/i18n';
import type { DecisionFact } from './catalog.fixture';
import { ScenarioFactsEditorComponent } from './scenario-facts-editor.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

function makeFact(overrides: Partial<DecisionFact>): DecisionFact {
  return {
    path: 'draft.sample',
    valueType: 'string',
    nullable: true,
    label: 'Sample fact',
    description: 'Sample description',
    providerRef: 'provider',
    evidenceRefs: [],
    sensitivity: 'NON_SENSITIVE',
    redaction: 'NONE',
    ...overrides
  };
}

describe('ScenarioFactsEditorComponent', () => {
  beforeAll(async () => {
    const fsModule = (
      globalThis as unknown as {
        process?: {
          getBuiltinModule?: (id: string) => {
            readFileSync: (file: URL, encoding: string) => string;
          };
        };
      }
    ).process?.getBuiltinModule?.('node:fs');

    await resolveComponentResources(async url => {
      if (url.endsWith('.scss')) {
        return '';
      }
      return fsModule?.readFileSync(new URL(url, import.meta.url), 'utf8') ?? '';
    });
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScenarioFactsEditorComponent],
      providers: [PolicyStudioI18n]
    }).compileComponents();
  });
  afterEach(() => TestBed.resetTestingModule());

  it('formats governed scalar and collection values without changing their canonical value', () => {
    const component = TestBed.runInInjectionContext(() => new ScenarioFactsEditorComponent());
    Object.defineProperty(component, 'values', { value: () => ({
      'request.amount': 500,
      'request.tags': ['priority', 'review'],
      'request.optional': null
    }) });

    expect(component.displayValue('request.amount')).toBe('500');
    expect(component.displayValue('request.tags')).toBe('priority, review');
    expect(component.displayValue('request.optional')).toBe('');
    expect(component.isNull('request.optional')).toBe(true);
  });

  it('humanizes technical fact slugs, strips seed placeholders, and keeps exact clean labels intact', () => {
    const component = TestBed.runInInjectionContext(() => new ScenarioFactsEditorComponent());

    const cleanFact = makeFact({ path: 'request.requestedAmount', label: 'Valor solicitado' });
    const slugFact = makeFact({
      path: 'codigoFrequencia: horaEntradaSaida',
      label: 'codigoFrequencia: horaEntradaSaida',
      description: 'Fato de avaliação do RuleSet benefits-rules (v1).',
      hint: 'Informe quando houver marcação horária.'
    });

    expect(component.factLabel(cleanFact)).toBe('Valor solicitado');
    expect(component.factLabel(slugFact)).toBe('Hora Entrada Saída');
    expect(component.factDescription(slugFact)).toEqual({
      description: '',
      hint: 'Informe quando houver marcação horária.',
      isTemplatePlaceholder: true
    });

    Object.defineProperty(component, 'viewDepth', { configurable: true, value: () => 'technical' });
    expect(component.factLabel(slugFact)).toBe('codigoFrequencia: horaEntradaSaida');
  });

  it('partitions evaluated and non-nullable required facts above nullable catalog-only facts', () => {
    const component = TestBed.runInInjectionContext(() => new ScenarioFactsEditorComponent());

    const amount = makeFact({ path: 'request.requestedAmount', label: 'Valor solicitado', nullable: false });
    const evaluatedOptional = makeFact({ path: 'request.justification', label: 'Justificativa', nullable: true });
    const otherRequired = makeFact({ path: 'request.tenantCode', label: 'Órgão', nullable: false });
    const otherOptional = makeFact({ path: 'neighborhood: historyCount', label: 'Histórico', nullable: true });

    Object.defineProperty(component, 'facts', {
      configurable: true,
      value: () => [amount, evaluatedOptional, otherRequired, otherOptional]
    });
    Object.defineProperty(component, 'primaryFactPaths', {
      configurable: true,
      value: () => ['request.requestedAmount', 'request.justification']
    });

    const partitioned = component.partitionedFacts();
    expect(partitioned.primary.map(fact => fact.path)).toEqual([
      'request.requestedAmount',
      'request.justification',
      'request.tenantCode'
    ]);
    expect(partitioned.other.map(fact => fact.path)).toEqual(['neighborhood: historyCount']);
  });

  it('detects scalar allowedValues selects and suppresses secret examples fail-closed', () => {
    const component = TestBed.runInInjectionContext(() => new ScenarioFactsEditorComponent());

    const statusFact = makeFact({
      path: 'worker.status',
      valueType: 'string',
      nullable: false,
      example: 'ACTIVE',
      allowedValues: [
        { value: 'ACTIVE', label: 'Ativo' },
        { value: 'INACTIVE', label: 'Inativo' }
      ],
      constraints: { minLength: 3, maxLength: 20 }
    });
    const secretFact = makeFact({
      path: 'actor.secret',
      valueType: 'string',
      sensitivity: 'SECRET',
      redaction: 'OMIT',
      example: 'secret-value',
      allowedValues: [{ value: 'ROOT', label: 'Root' }]
    });

    expect(component.hasScalarAllowedValues(statusFact)).toBe(true);
    expect(component.examplePlaceholder(statusFact)).toContain('ACTIVE');
    expect(component.hasScalarAllowedValues(secretFact)).toBe(false);
    expect(component.examplePlaceholder(secretFact)).toBe('');
  });

  it('renders placeholder options, non-blocking ReDoS-safe advisories, privacy notices, aria-describedby, and unique checkbox labels in DOM', () => {
    const fixture = TestBed.createComponent(ScenarioFactsEditorComponent);
    const changes: unknown[] = [];
    fixture.componentInstance.valueChanged.subscribe(change => changes.push(change));

    const amount = makeFact({
      path: 'request.requestedAmount',
      valueType: 'number',
      nullable: false,
      label: 'Valor solicitado',
      description: 'Valor pedido.',
      unit: 'days',
      constraints: { min: 10, max: 100, step: 0.5 },
      sensitivity: 'SENSITIVE',
      redaction: 'MASK'
    });
    const status = makeFact({
      path: 'worker.status',
      valueType: 'string',
      nullable: true,
      label: 'Situação',
      allowedValues: [{ value: 'ACTIVE', label: 'Ativo' }]
    });
    const code = makeFact({
      path: 'request.code',
      valueType: 'string',
      nullable: true,
      label: 'Código',
      constraints: { minLength: 3, maxLength: 5, pattern: '(a+)+$' }
    });
    const active = makeFact({
      path: 'worker.active',
      valueType: 'boolean',
      nullable: false,
      label: 'Ativo'
    });

    const factsSig = signal<readonly DecisionFact[]>([amount, status, code, active]);
    const valuesSig = signal<Readonly<Record<string, unknown>>>({
      'request.requestedAmount': 5,
      'request.code': 'A'
    });
    const viewDepthSig = signal<'business' | 'technical'>('business');
    Object.defineProperty(fixture.componentInstance, 'facts', { configurable: true, value: factsSig });
    Object.defineProperty(fixture.componentInstance, 'values', { configurable: true, value: valuesSig });
    Object.defineProperty(fixture.componentInstance, 'viewDepth', { configurable: true, value: viewDepthSig });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const numberInput = el.querySelector('input[type="number"]') as HTMLInputElement;
    expect(numberInput.hasAttribute('min')).toBe(false);
    expect(numberInput.hasAttribute('max')).toBe(false);
    expect(numberInput.getAttribute('step')).toBe('0.5');
    expect(numberInput.getAttribute('aria-describedby')).toBeTruthy();

    const fieldLabel = el.querySelector('.scenario-fact-field > label') as HTMLLabelElement;
    expect(fieldLabel.getAttribute('title')).toBeNull();
    expect(el.querySelector('.scenario-fact-unit')?.textContent?.trim()).toBe('dias');
    expect(el.querySelector('.scenario-fact-privacy')?.textContent).toContain('Dado pessoal ou sensível');

    const advisories = Array.from(el.querySelectorAll('[data-testid="scenario-fact-advisory"]')).map(node => node.textContent);
    expect(advisories.some(text => text?.includes('10'))).toBe(true);
    expect(advisories.some(text => text?.includes('3'))).toBe(true);

    const selects = el.querySelectorAll('select');
    const statusSelect = selects[0] as HTMLSelectElement;
    expect(statusSelect.value).toBe('');
    expect(Array.from(statusSelect.options).map(o => o.value)).toEqual(['', 'ACTIVE']);
    statusSelect.value = 'ACTIVE';
    statusSelect.dispatchEvent(new Event('change'));
    statusSelect.value = '';
    statusSelect.dispatchEvent(new Event('change'));

    const boolSelect = selects[1] as HTMLSelectElement;
    expect(boolSelect.value).toBe('');
    expect(Array.from(boolSelect.options).map(o => o.value)).toEqual(['', 'false', 'true']);
    boolSelect.value = '';
    boolSelect.dispatchEvent(new Event('change'));

    expect(changes).toEqual([
      { fact: status, value: 'ACTIVE' },
      { fact: status, value: undefined },
      { fact: active, value: undefined }
    ]);

    const groupHeadings = Array.from(el.querySelectorAll('.scenario-fact-group-heading')).map(node => node.textContent?.trim());
    expect(groupHeadings).toEqual(['Dados do registro', 'Worker']);

    const checkboxes = el.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes[0]?.getAttribute('aria-label')).toBe('Usar valor nulo para Código');
    expect(checkboxes[1]?.getAttribute('aria-label')).toBe('Usar valor nulo para Situação');
    fixture.destroy();
  });
});
