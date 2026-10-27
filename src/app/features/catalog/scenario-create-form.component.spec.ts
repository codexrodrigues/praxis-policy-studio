import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PolicyStudioI18n } from '../../core/i18n';
import { buildSuggestedScenarioTemplates } from './catalog-presentation';
import type { DecisionSummary } from './catalog.fixture';
import { ScenarioCreateFormComponent } from './scenario-create-form.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('ScenarioCreateFormComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('projects canonical outcomes as human labels', () => {
    TestBed.configureTestingModule({ providers: [PolicyStudioI18n] });
    const component = TestBed.runInInjectionContext(() => new ScenarioCreateFormComponent());
    expect(component.outcome('ALLOW')).toBe('Permitida');
    expect(component.outcome('TECHNICAL_ERROR')).toBe('Erro técnico');
  });

  it('derives typed ALLOW and DENY scenario suggestions from governed condition and parameter catalog', () => {
    const decision: DecisionSummary = {
      order: 1,
      totalDecisions: 1,
      key: 'benefits.extraordinary.amount-limit',
      code: 'GRANT-10',
      name: 'Limite do auxílio',
      domain: 'benefits',
      ruleSet: 'Extraordinary grant',
      ruleSetKey: 'grant-rules',
      state: 'verified',
      meaning: 'Limita o valor solicitado.',
      resourceKey: 'test-resource',
      serviceKey: 'test-service',
      authority: 'CONFIG',
      baselineAuthority: 'SYNTHETIC_BASELINE',
      source: 'quickstart',
      evidenceCount: 1,
      authoringSupported: true,
      availableDefinitionActions: [],
      expression: 'requestedAmount <= 3000',
      condition: {
        and: [
          { '<=': [{ var: 'requestedAmount' }, { var: 'parameters.maxGrantAmount' }] },
          { '===': [{ var: 'activeEnrollment' }, true] }
        ]
      },
      factPaths: ['requestedAmount', 'activeEnrollment'],
      facts: [
        {
          path: 'requestedAmount',
          label: 'Valor solicitado',
          valueType: 'number',
          nullable: false,
          description: '',
          providerRef: 'test-provider',
          evidenceRefs: [],
          sensitivity: 'NON_SENSITIVE',
          redaction: 'NONE'
        },
        {
          path: 'activeEnrollment',
          label: 'Vínculo ativo',
          valueType: 'boolean',
          nullable: false,
          description: '',
          providerRef: 'test-provider',
          evidenceRefs: [],
          sensitivity: 'NON_SENSITIVE',
          redaction: 'NONE'
        }
      ],
      nullSemantics: 'FAIL_CLOSED',
      operationKeys: ['CREATE'],
      hostContractVersion: 'v1',
      evidence: [],
      draftLifecycle: null,
      parameters: { maxGrantAmount: 3000 }
    };

    const suggestions = buildSuggestedScenarioTemplates(decision);
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]).toEqual({
      id: 'ALLOW',
      scenarioKey: 'amount-limit-allow',
      name: 'GRANT-10 — ALLOW',
      expectedDecision: 'ALLOW',
      expectedReasonCodes: [],
      factValues: {
        requestedAmount: 3000,
        activeEnrollment: true
      }
    });
    expect(suggestions[1]).toEqual({
      id: 'DENY',
      scenarioKey: 'amount-limit-deny',
      name: 'GRANT-10 — DENY',
      expectedDecision: 'DENY',
      expectedReasonCodes: ['GRANT-10'],
      factValues: {
        requestedAmount: 3100,
        activeEnrollment: false
      }
    });

    TestBed.configureTestingModule({ providers: [PolicyStudioI18n] });
    const component = TestBed.runInInjectionContext(() => new ScenarioCreateFormComponent());
    const emitted = vi.fn();
    component.suggestionApplied.subscribe(emitted);
    const keyInput = document.createElement('input');
    const nameInput = document.createElement('input');
    const decisionSelect = document.createElement('select');
    decisionSelect.innerHTML = '<option value="ALLOW">ALLOW</option><option value="DENY">DENY</option>';
    const reasonsTextarea = document.createElement('textarea');

    component.applySuggestion(suggestions[1], keyInput, nameInput, decisionSelect, reasonsTextarea);
    expect(keyInput.value).toBe('amount-limit-deny');
    expect(nameInput.value).toBe('GRANT-10 — DENY');
    expect(decisionSelect.value).toBe('DENY');
    expect(reasonsTextarea.value).toBe('GRANT-10');
    expect(emitted).toHaveBeenCalledWith(suggestions[1]);
  });
});
