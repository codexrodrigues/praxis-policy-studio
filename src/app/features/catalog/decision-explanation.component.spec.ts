import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DecisionExplanationService, type DecisionExplanationEvent } from '../../core/decision-explanation.service';
import { PolicyStudioI18n } from '../../core/i18n';
import type { DecisionSummary } from './catalog.fixture';
import { DecisionExplanationComponent } from './decision-explanation.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

const config = {
  mode: 'remote' as const,
  configApiBaseUrl: '',
  locale: 'pt-BR' as const,
  projectionPath: '/projections/test.json',
  initialDecisionKey: null
};

function decision(version = 2): DecisionSummary {
  return {
    order: 1, totalDecisions: 1, key: 'grant.amount-parameters', code: 'GRANT-10',
    name: 'Limite do auxílio', domain: 'benefits', ruleSet: 'Extraordinary grant',
    ruleSetKey: 'grant-rules', state: 'verified', meaning: 'Limita o valor solicitado.',
    resourceKey: 'test-resource', serviceKey: 'test-service',
    authority: 'CONFIG', baselineAuthority: 'SYNTHETIC_BASELINE', source: 'quickstart',
    evidenceCount: 1, authoringSupported: true, availableDefinitionActions: [],
    configDefinitionId: '7b0fca89-cb64-40bf-8eea-d3467083bbf4', configVersion: version,
    expression: null, condition: { '<=': [{ var: 'requestedAmount' }, 1000] },
    factPaths: ['requestedAmount'], facts: [], nullSemantics: 'fail_closed',
    operationKeys: ['CREATE'], hostContractVersion: 'v1', evidence: [], draftLifecycle: null
  };
}

describe('DecisionExplanationComponent', () => {
  const explanationEvents = new Subject<DecisionExplanationEvent>();
  const explain = vi.fn();

  beforeEach(() => {
    explain.mockReset();
    explain.mockReturnValue(explanationEvents.asObservable());
    TestBed.configureTestingModule({ providers: [
      PolicyStudioI18n,
      { provide: DecisionExplanationService, useValue: { explain } }
    ] });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('requests the exact selected version and exposes only a consultative result', () => {
    const component = TestBed.runInInjectionContext(() => new DecisionExplanationComponent(TestBed.inject(PolicyStudioI18n)));
    component.decision = decision();
    component.config = config;
    component.explain();

    expect(explain).toHaveBeenCalledWith(expect.objectContaining({
      definitionId: '7b0fca89-cb64-40bf-8eea-d3467083bbf4',
      ruleKey: 'grant.amount-parameters',
      version: 2
    }));
    explanationEvents.next({
      kind: 'completed', message: 'Explicação segura.', canApply: false,
      evidence: {
        schemaVersion: 'v1', definitionHash: 'd', conditionHash: 'c', resolvedVersion: 2,
        exposureMode: 'summary_only', redactionMode: 'summary_only', sourceRefCount: 1
      }
    });
    expect(component.state()).toMatchObject({ kind: 'completed', canApply: false });
  });

  it('drops a response that arrives after the selected decision changes', () => {
    const first = new Subject<DecisionExplanationEvent>();
    const second = new Subject<DecisionExplanationEvent>();
    explain.mockReturnValueOnce(first.asObservable()).mockReturnValueOnce(second.asObservable());
    const component = TestBed.runInInjectionContext(() => new DecisionExplanationComponent(TestBed.inject(PolicyStudioI18n)));
    component.decision = decision(2);
    component.config = config;
    component.explain();
    component.decision = decision(3);
    component.ngOnChanges();
    component.explain();

    first.next({ kind: 'failed', reason: 'failed' });
    second.next({ kind: 'progress' });
    expect(component.state()).toEqual({ kind: 'progress' });
  });

  it('does not expose the command for fixture or unversioned decisions', () => {
    const component = TestBed.runInInjectionContext(() => new DecisionExplanationComponent(TestBed.inject(PolicyStudioI18n)));
    component.decision = { ...decision(), configVersion: undefined };
    component.config = config;
    expect(component.available()).toBe(false);
    component.config = { ...config, mode: 'fixture', configApiBaseUrl: null };
    expect(component.available()).toBe(false);
  });
});
