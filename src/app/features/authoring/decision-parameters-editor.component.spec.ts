import '@angular/compiler';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PolicyStudioI18n } from '../../core/i18n';
import type { DecisionParameterCatalog } from '../catalog/catalog.fixture';
import {
  DecisionParametersEditorComponent,
  evaluateParameterInvariant
} from './decision-parameters-editor.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

function createBoundsCatalog(): DecisionParameterCatalog {
  return {
    definitionId: 'def-bounds',
    ruleKey: 'tempo.frequencia.retroactive',
    version: 1,
    schemaVersion: 'praxis.domain-rule-parameter-catalog.v1',
    templateKey: 'ergon.frequencia:retroactive-bounds',
    templateVersion: '1.0',
    parameters: [
      {
        name: 'minRetroactiveDays',
        label: 'Mínimo retroativo',
        description: 'Limite inferior da janela retroativa.',
        legalBasis: 'Lei Estadual 10.460/1988, art. 42',
        group: 'retroatividade',
        displayOrder: 1,
        type: 'INTEGER',
        required: true,
        nullable: false,
        readOnly: false,
        defaultValue: 0,
        declaredValue: 0,
        effectiveValue: 0,
        minimum: 0,
        maximum: 180,
        unit: 'days',
        origin: 'DEFAULT'
      },
      {
        name: 'maxRetroactiveDays',
        label: 'Máximo retroativo',
        description: 'Limite superior da janela retroativa.',
        legalBasis: 'Lei Estadual 10.460/1988, art. 43',
        group: 'retroatividade',
        displayOrder: 2,
        type: 'INTEGER',
        required: true,
        nullable: false,
        readOnly: false,
        defaultValue: 60,
        declaredValue: 60,
        effectiveValue: 60,
        minimum: 1,
        maximum: 365,
        unit: 'days',
        origin: 'DEFAULT'
      }
    ],
    invariants: [
      {
        code: 'MIN_LTE_MAX',
        message: 'O valor de minRetroactiveDays deve ser menor ou igual a maxRetroactiveDays.',
        expression: { '<=': [{ var: 'minRetroactiveDays' }, { var: 'maxRetroactiveDays' }] }
      }
    ]
  };
}

describe('DecisionParametersEditorComponent (Contract 1.8 metadata & invariants)', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [PolicyStudioI18n] }));
  afterEach(() => TestBed.resetTestingModule());

  it('tracks Contract 1.8 metadata describedBy ids, evaluates lte invariants, and clears errors once resolved', () => {
    const editor = TestBed.runInInjectionContext(() => new DecisionParametersEditorComponent());
    const catalog = createBoundsCatalog();
    const catalogSignal = signal<DecisionParameterCatalog | null>(catalog);
    const paramsSignal = signal<Readonly<Record<string, unknown>>>({
      parameterValues: { minRetroactiveDays: 90, maxRetroactiveDays: 60 }
    });
    Object.defineProperty(editor, 'parameterCatalog', { configurable: true, value: catalogSignal });
    Object.defineProperty(editor, 'parameters', { configurable: true, value: paramsSignal });

    const emittedErrors: Array<readonly string[]> = [];
    editor.validationErrorsChanged.subscribe(errs => emittedErrors.push(errs));

    expect(editor.describedByIds(catalog.parameters[0])).toBe(
      'param-help-minRetroactiveDays param-legal-minRetroactiveDays param-bounds-minRetroactiveDays'
    );
    expect(editor.invariantStates()).toEqual([
      expect.objectContaining({ violated: true })
    ]);
    TestBed.flushEffects();
    expect(emittedErrors.at(-1)).toEqual([
      'O valor de minRetroactiveDays deve ser menor ou igual a maxRetroactiveDays.'
    ]);

    paramsSignal.set({ parameterValues: { minRetroactiveDays: 10, maxRetroactiveDays: 60 } });
    expect(editor.invariantStates()).toEqual([
      expect.objectContaining({ violated: false })
    ]);
    TestBed.flushEffects();
    expect(emittedErrors.at(-1)).toEqual([]);
  });

  it('evaluates sumLte invariants and flags violations through validationErrorsChanged', () => {
    const sumCatalog: DecisionParameterCatalog = {
      definitionId: 'def-cotas',
      ruleKey: 'concurso.cotas',
      version: 1,
      schemaVersion: 'praxis.domain-rule-parameter-catalog.v1',
      templateKey: 'ergon.concurso:cotas-teto',
      templateVersion: '1.0',
      parameters: [
        {
          name: 'percentualPcd',
          label: 'Cota PcD',
          type: 'INTEGER',
          required: true,
          nullable: false,
          readOnly: false,
          defaultValue: 20,
          effectiveValue: 20,
          minimum: 0,
          maximum: 50,
          unit: '%'
        },
        {
          name: 'percentualRacial',
          label: 'Cota racial',
          type: 'INTEGER',
          required: true,
          nullable: false,
          readOnly: false,
          defaultValue: 30,
          effectiveValue: 30,
          minimum: 0,
          maximum: 50,
          unit: '%'
        }
      ],
      invariants: [
        {
          code: 'COTAS_SUM_CAP',
          message: 'A soma das cotas não pode ultrapassar 50%.',
          expression: { '<=': [{ '+': [{ var: 'percentualPcd' }, { var: 'percentualRacial' }] }, 50] }
        }
      ]
    };

    const editor = TestBed.runInInjectionContext(() => new DecisionParametersEditorComponent());
    const catalogSignal = signal<DecisionParameterCatalog | null>(sumCatalog);
    const paramsSignal = signal<Readonly<Record<string, unknown>>>({
      parameterValues: { percentualPcd: 30, percentualRacial: 25 }
    });
    Object.defineProperty(editor, 'parameterCatalog', { configurable: true, value: catalogSignal });
    Object.defineProperty(editor, 'parameters', { configurable: true, value: paramsSignal });

    const emittedErrors: Array<readonly string[]> = [];
    editor.validationErrorsChanged.subscribe(errs => emittedErrors.push(errs));

    TestBed.flushEffects();
    expect(emittedErrors.at(-1)).toEqual(['A soma das cotas não pode ultrapassar 50%.']);

    expect(evaluateParameterInvariant(
      { '<=': [{ '+': [{ var: 'a' }, { var: 'b' }] }, 50] },
      { a: 20, b: 30 }
    )).toBe(true);
    expect(evaluateParameterInvariant(
      { customOp: [{ var: 'a' }] },
      { a: 10 }
    )).toBeNull();
  });
});
