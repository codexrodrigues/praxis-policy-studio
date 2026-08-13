import '@angular/compiler';
import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSessionService } from '../../core/auth-session.service';
import { PolicyStudioI18n } from '../../core/i18n';
import { ProjectionCatalogService } from '../../core/projection-catalog.service';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import type { DecisionSummary } from './catalog.fixture';
import { CatalogWorkspaceComponent } from './catalog-workspace.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

const config = {
  mode: 'fixture' as const,
  configApiBaseUrl: null,
  locale: 'pt-BR' as const,
  projectionPath: '/projections/test.json',
  initialDecisionKey: null
};

function decision(key: string): DecisionSummary {
  return {
    order: 1, totalDecisions: 2, key, code: key, name: key, domain: 'test',
    ruleSet: 'Test', ruleSetKey: 'test-rules', state: 'verified', meaning: key,
    authority: 'CONFIG', baselineAuthority: 'SYNTHETIC_BASELINE', source: 'test',
    evidenceCount: 0, configDefinitionId: `definition-${key}`, workspaceId: `workspace-${key}`,
    expression: null, condition: { '===': [1, 1] }, factPaths: [], facts: [],
    nullSemantics: null, operationKeys: [], hostContractVersion: null, evidence: [],
    draftLifecycle: null
  };
}

describe('CatalogWorkspaceComponent selection isolation', () => {
  const timelines = { A: new Subject<any>(), B: new Subject<any>() };
  const lifecycles = { A: new Subject<any>(), B: new Subject<any>() };
  const scenarios = { A: new Subject<any>(), B: new Subject<any>() };
  const reviews = { A: new Subject<any>(), B: new Subject<any>() };
  let component: CatalogWorkspaceComponent;

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    TestBed.configureTestingModule({ providers: [
      PolicyStudioI18n,
      { provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
      { provide: AuthSessionService, useValue: {} },
      { provide: RuntimeConfigService, useValue: { state: () => ({ kind: 'ready', config }), mode: () => 'fixture' } },
      { provide: ProjectionCatalogService, useValue: {
        timeline: (id: string) => timelines[id.endsWith('A') ? 'A' : 'B'].asObservable(),
        lifecycle: (id: string) => lifecycles[id.endsWith('A') ? 'A' : 'B'].asObservable(),
        scenarios: (id: string) => scenarios[id.endsWith('A') ? 'A' : 'B'].asObservable(),
        reviews: (id: string) => reviews[id.endsWith('A') ? 'A' : 'B'].asObservable()
      } }
    ] });
    component = TestBed.runInInjectionContext(() => new CatalogWorkspaceComponent(TestBed.inject(PolicyStudioI18n)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('ignores timeline, lifecycle, scenario, review and error responses from a previous selection', () => {
    component.select(decision('A'));
    component.select(decision('B'));

    timelines.B.next([{ eventType: 'B', occurredAt: '2026-08-13T12:00:00Z', summary: 'B', status: null, actor: null }]);
    lifecycles.B.next({ workspaceStatus: 'B', workspaceRevision: 2, testRunCount: 1, reviewCount: 1, materializationCount: 0, promotedDefinitionId: null });
    scenarios.B.next([{ id: 'scenario-B' }]);
    reviews.B.next([{ id: 'review-B' }]);

    timelines.A.next([{ eventType: 'A', occurredAt: '2026-08-13T11:00:00Z', summary: 'A', status: null, actor: null }]);
    lifecycles.A.next({ workspaceStatus: 'A', workspaceRevision: 1, testRunCount: 0, reviewCount: 0, materializationCount: 0, promotedDefinitionId: null });
    scenarios.A.error(new Error('stale scenario failure'));
    reviews.A.error(new Error('stale review failure'));

    expect(component.selected()?.key).toBe('B');
    expect(component.timeline()[0]?.eventType).toBe('B');
    expect(component.lifecycle()?.workspaceStatus).toBe('B');
    expect(component.scenarios()[0]?.id).toBe('scenario-B');
    expect(component.reviews()[0]?.id).toBe('review-B');
    expect(component.authoringError()).toBe(false);
  });
});
