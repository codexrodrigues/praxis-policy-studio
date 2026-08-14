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
import type { DecisionLifecycleSummary, DecisionSummary } from './catalog.fixture';
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
    workspaceEtag: `etag-${key}`,
    expression: null, condition: { '===': [1, 1] }, factPaths: [], facts: [],
    nullSemantics: null, operationKeys: [], hostContractVersion: null, evidence: [],
    draftLifecycle: null
  };
}

describe('CatalogWorkspaceComponent selection isolation', () => {
  const timelines = { A: [] as Subject<any>[], B: [] as Subject<any>[] };
  const lifecycles = { A: [] as Subject<any>[], B: [] as Subject<any>[] };
  const scenarios = { A: [] as Subject<any>[], B: [] as Subject<any>[] };
  const reviews = { A: [] as Subject<any>[], B: [] as Subject<any>[] };
  const capabilities = { A: [] as Subject<any>[], B: [] as Subject<any>[] };
  let component: CatalogWorkspaceComponent;

  const stream = (streams: Record<'A' | 'B', Subject<any>[]>, id: string) => {
    const key = id.endsWith('A') ? 'A' : 'B';
    const subject = new Subject<any>();
    streams[key].push(subject);
    return subject.asObservable();
  };

  beforeEach(() => {
    for (const streams of [timelines, lifecycles, scenarios, reviews, capabilities]) {
      streams.A.length = 0;
      streams.B.length = 0;
    }
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
        timeline: (id: string) => stream(timelines, id),
        lifecycle: (id: string) => stream(lifecycles, id),
        scenarios: (id: string) => stream(scenarios, id),
        reviews: (id: string) => stream(reviews, id),
        workspaceCapabilities: (id: string) => stream(capabilities, id)
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
    component.sandboxRun.set({ runId: 'run-A' } as any);
    component.publicationReadiness.set({ readiness: 'ready_to_publish' } as any);
    component.publicationResult.set({ status: 'published' } as any);
    component.select(decision('B'));

    timelines.B[0].next([{ eventType: 'B', occurredAt: '2026-08-13T12:00:00Z', summary: 'B', status: null, actor: null }]);
    lifecycles.B[0].next({ workspaceStatus: 'B', workspaceRevision: 2, testRunCount: 1, reviewCount: 1, materializationCount: 0, promotedDefinitionId: null });
    scenarios.B[0].next([{ id: 'scenario-B' }]);
    reviews.B[0].next([{ id: 'review-B' }]);
    capabilities.B[0].next({ workspaceId: 'workspace-B', availableActions: ['VIEW', 'REVIEW'], blockers: [] });

    timelines.A[0].next([{ eventType: 'A', occurredAt: '2026-08-13T11:00:00Z', summary: 'A', status: null, actor: null }]);
    lifecycles.A[0].next({ workspaceStatus: 'A', workspaceRevision: 1, testRunCount: 0, reviewCount: 0, materializationCount: 0, promotedDefinitionId: null });
    scenarios.A[0].error(new Error('stale scenario failure'));
    reviews.A[0].error(new Error('stale review failure'));
    capabilities.A[0].error(new Error('stale capabilities failure'));

    expect(component.selected()?.key).toBe('B');
    expect(component.timeline()[0]?.eventType).toBe('B');
    expect(component.lifecycle()?.workspaceStatus).toBe('B');
    expect(component.scenarios()[0]?.id).toBe('scenario-B');
    expect(component.reviews()[0]?.id).toBe('review-B');
    expect(component.authoringError()).toBe(false);
    expect(component.hasWorkspaceAction('REVIEW')).toBe(true);
    expect(component.sandboxRun()).toBeNull();
    expect(component.publicationReadiness()).toBeNull();
    expect(component.publicationResult()).toBeNull();
  });

  it('ignores older success and error responses when the same resource is reloaded', () => {
    component.select(decision('A'));
    component.loadTimeline();
    component.loadLifecycle();
    component.loadScenarios();
    component.loadReviews();
    component.loadWorkspaceCapabilities();

    timelines.A[1].next([{ eventType: 'NEW', occurredAt: '2026-08-13T12:00:00Z', summary: 'new', status: null, actor: null }]);
    lifecycles.A[1].next({ workspaceStatus: 'NEW', workspaceRevision: 2, testRunCount: 1, reviewCount: 1, materializationCount: 0, promotedDefinitionId: null });
    scenarios.A[1].next([{ id: 'scenario-new' }]);
    reviews.A[1].next([{ id: 'review-new' }]);
    capabilities.A[1].next({ workspaceId: 'workspace-A', availableActions: ['VIEW', 'SUBMIT'], blockers: [] });

    timelines.A[0].next([{ eventType: 'OLD', occurredAt: '2026-08-13T11:00:00Z', summary: 'old', status: null, actor: null }]);
    lifecycles.A[0].next({ workspaceStatus: 'OLD', workspaceRevision: 1, testRunCount: 0, reviewCount: 0, materializationCount: 0, promotedDefinitionId: null });
    scenarios.A[0].error(new Error('older scenario failure'));
    reviews.A[0].error(new Error('older review failure'));
    capabilities.A[0].error(new Error('older capabilities failure'));

    expect(component.timeline()[0]?.eventType).toBe('NEW');
    expect(component.lifecycle()?.workspaceStatus).toBe('NEW');
    expect(component.scenarios()[0]?.id).toBe('scenario-new');
    expect(component.reviews()[0]?.id).toBe('review-new');
    expect(component.authoringError()).toBe(false);
    expect(component.hasWorkspaceAction('SUBMIT')).toBe(true);
  });

  it('fails closed before invoking a governed mutation when Config did not publish its action', () => {
    component.select(decision('A'));
    component.updateDraft({ '===': [1, 2] });

    component.saveGovernedDraft();
    component.submitGovernedWorkspace();
    component.promoteGovernedWorkspace();

    expect(component.authoringBusy()).toBe(false);
    expect(component.hasWorkspaceAction('UPDATE_DRAFT')).toBe(false);
    expect(component.hasWorkspaceAction('SUBMIT')).toBe(false);
    expect(component.hasWorkspaceAction('PROMOTE')).toBe(false);
  });

  it('projects only sanitized operational evidence from the latest governed Test Run', () => {
    component.lifecycle.set({
      workspaceStatus: 'OPEN', workspaceRevision: 2, testRunCount: 1, reviewCount: 0,
      materializationCount: 0, promotedDefinitionId: null,
      latestTestRun: {
        results: [{
          scenarioKey: 'update-denied',
          operationalEvidence: {
            operationMode: 'UPDATE', beforeStateDigest: 'A'.repeat(64),
            afterStateDigest: 'A'.repeat(64), mutationObserved: false,
            noMutationVerified: true, cleanupVerified: true, baselineCallCount: 1
          }
        }]
      }
    } as unknown as DecisionLifecycleSummary);

    expect(component.operationalTestEvidence()).toEqual([expect.objectContaining({
      scenarioKey: 'update-denied',
      evidence: expect.objectContaining({ operationMode: 'UPDATE', noMutationVerified: true })
    })]);
  });
});
