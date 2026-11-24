import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
  beforeEach(() => TestBed.configureTestingModule({ providers: [PolicyStudioI18n] }));
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
});
