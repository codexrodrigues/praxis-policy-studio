import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DecisionDiscoveryService, type DecisionDiscoveryEvent } from '../../core/decision-discovery.service';
import { PolicyStudioI18n } from '../../core/i18n';
import type { DecisionSummary } from './catalog.fixture';
import { DecisionDiscoveryComponent } from './decision-discovery.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

const config = {
  mode: 'remote' as const,
  configApiBaseUrl: '',
  locale: 'pt-BR' as const,
  projectionPath: '/projections/test.json',
  initialDecisionKey: null
};

const decision: DecisionSummary = {
  order: 1, totalDecisions: 1, key: 'grant.amount-parameters', code: 'GRANT-10',
  name: 'Limite do auxílio', domain: 'benefits', ruleSet: 'Extraordinary grant',
  ruleSetKey: 'grant-rules', state: 'verified', meaning: 'Limita o valor solicitado.',
  resourceKey: 'test-resource', serviceKey: 'test-service',
  authority: 'CONFIG', baselineAuthority: 'SYNTHETIC_BASELINE', source: 'quickstart',
  evidenceCount: 1, authoringSupported: true, availableDefinitionActions: [],
  configDefinitionId: '7b0fca89-cb64-40bf-8eea-d3467083bbf4', configVersion: 3,
  expression: null, condition: null, factPaths: [], facts: [], nullSemantics: null,
  operationKeys: ['CREATE'], hostContractVersion: 'v1', evidence: [], draftLifecycle: null
};

const candidate = {
  definitionId: decision.configDefinitionId as string,
  ruleKey: decision.key,
  version: decision.configVersion as number,
  ruleType: 'JSON_LOGIC_DECISION', status: 'approved', contextKey: 'benefits',
  resourceKey: 'test-resource', serviceKey: 'test-service', semanticOwner: 'benefits-policy', updatedAt: ''
};

describe('DecisionDiscoveryComponent', () => {
  const events = new Subject<DecisionDiscoveryEvent>();
  const discover = vi.fn();

  beforeEach(() => {
    discover.mockReset();
    discover.mockReturnValue(events.asObservable());
    TestBed.configureTestingModule({ providers: [
      PolicyStudioI18n,
      { provide: DecisionDiscoveryService, useValue: { discover } }
    ] });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('sends business intent to the runtime and selects only an exact projected identity', () => {
    const component = TestBed.runInInjectionContext(() => new DecisionDiscoveryComponent(TestBed.inject(PolicyStudioI18n)));
    component.config = config;
    component.decisions = [decision];
    const selected = vi.fn();
    component.decisionSelected.subscribe(selected);

    component.discover(' regras para valor de auxílio ');
    expect(discover).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'regras para valor de auxílio', locale: 'pt-BR'
    }));
    component.select(candidate);
    expect(selected).toHaveBeenCalledWith(decision);
  });

  it('does not select a stale or external candidate', () => {
    const component = TestBed.runInInjectionContext(() => new DecisionDiscoveryComponent(TestBed.inject(PolicyStudioI18n)));
    component.config = config;
    component.decisions = [decision];
    const selected = vi.fn();
    component.decisionSelected.subscribe(selected);
    const stale = { ...candidate, version: 2 };

    expect(component.matchingDecision(stale)).toBeNull();
    component.select(stale);
    expect(selected).not.toHaveBeenCalled();
  });

  it('requires a meaningful prompt and hides discovery in fixture mode', () => {
    const component = TestBed.runInInjectionContext(() => new DecisionDiscoveryComponent(TestBed.inject(PolicyStudioI18n)));
    component.config = config;
    component.discover('  x ');
    expect(component.inputInvalid()).toBe(true);
    expect(discover).not.toHaveBeenCalled();
    component.config = { ...config, mode: 'fixture', configApiBaseUrl: null };
    expect(component.available()).toBe(false);
  });
});
