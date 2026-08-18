import '@angular/compiler';
import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { of, Subject } from 'rxjs';
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
    resourceKey: 'human-resources.extraordinary-benefit-requests', serviceKey: 'test-service',
    authority: 'CONFIG', baselineAuthority: 'SYNTHETIC_BASELINE', source: 'test',
    evidenceCount: 0, authoringSupported: true, availableDefinitionActions: [],
    configDefinitionId: `definition-${key}`, workspaceId: `workspace-${key}`,
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
  const createWorkspace = vi.fn();
  const createScenario = vi.fn();
  const updateScenario = vi.fn();
  const reviewWorkspace = vi.fn();
  let sandboxRuns: Subject<any>[];
  let runSandbox: ReturnType<typeof vi.fn>;
  const operationalTestAction = vi.fn();
  const runOperationalTest = vi.fn();
  const logoutSession = vi.fn();
  let logoutResult: Subject<void>;
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
    sandboxRuns = [];
    runSandbox = vi.fn(() => {
      const subject = new Subject<any>();
      sandboxRuns.push(subject);
      return subject.asObservable();
    });
    createWorkspace.mockReset();
    createScenario.mockReset();
    updateScenario.mockReset();
    reviewWorkspace.mockReset();
    operationalTestAction.mockReset();
    runOperationalTest.mockReset();
    logoutSession.mockReset();
    logoutResult = new Subject<void>();
    logoutSession.mockReturnValue(logoutResult.asObservable());
    operationalTestAction.mockReturnValue(of(null));
    createWorkspace.mockReturnValue(of({
      id: 'workspace-A', ruleKey: 'A', status: 'OPEN', etag: 'etag-new', revision: 1,
      parameters: {}
    }));
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    TestBed.configureTestingModule({ providers: [
      PolicyStudioI18n,
      { provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
      { provide: AuthSessionService, useValue: { logout: logoutSession } },
      { provide: RuntimeConfigService, useValue: { state: () => ({ kind: 'ready', config }), mode: () => 'fixture' } },
      { provide: ProjectionCatalogService, useValue: {
        timeline: (id: string) => stream(timelines, id),
        lifecycle: (id: string) => stream(lifecycles, id),
        scenarios: (id: string) => stream(scenarios, id),
        reviews: (id: string) => stream(reviews, id),
        workspaceCapabilities: (id: string) => stream(capabilities, id),
        operationalTestAction,
        runOperationalTest,
        createWorkspace,
        createScenario,
        updateScenario,
        reviewWorkspace,
        runSandbox
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
    lifecycles.B[0].next({ workspaceStatus: 'B', workspaceRevision: 2, testRunCount: 1, reviewCount: 1, materializationCount: 0, promotedDefinitionId: null, submittedTestRunId: 'run-B', latestTestRun: null });
    scenarios.B[0].next([{ id: 'scenario-B' }]);
    reviews.B[0].next([{ id: 'review-B' }]);
    capabilities.B[0].next({ workspaceId: 'workspace-B', availableActions: ['VIEW', 'REVIEW'], blockers: [] });

    timelines.A[0].next([{ eventType: 'A', occurredAt: '2026-08-13T11:00:00Z', summary: 'A', status: null, actor: null }]);
    lifecycles.A[0].next({ workspaceStatus: 'A', workspaceRevision: 1, testRunCount: 0, reviewCount: 0, materializationCount: 0, promotedDefinitionId: null, submittedTestRunId: null, latestTestRun: null });
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

  it('invalidates governed in-memory state after the host closes the session', () => {
    const current = decision('A');
    component.allDecisions.set([current]);
    component.select(current);
    component.sessionActive.set(true);

    component.logout();
    expect(logoutSession).toHaveBeenCalledWith(config);
    expect(component.signingOut()).toBe(true);

    logoutResult.next();
    logoutResult.complete();

    expect(component.sessionActive()).toBe(false);
    expect(component.selected()).toBeNull();
    expect(component.allDecisions()).toEqual([]);
    expect(component.authenticationRequired()).toBe(true);
    expect(component.signingOut()).toBe(false);
  });

  it('creates a workspace only when Config publishes CREATE_NEW_VERSION for the exact definition', () => {
    component.select({
      ...decision('A'), workspaceId: undefined, workspaceEtag: undefined,
      availableDefinitionActions: []
    });
    component.createWorkspace();
    expect(createWorkspace).not.toHaveBeenCalled();

    component.select({
      ...decision('A'), workspaceId: undefined, workspaceEtag: undefined,
      availableDefinitionActions: ['CREATE_NEW_VERSION']
    }, true);
    component.createWorkspace();
    expect(createWorkspace).toHaveBeenCalledOnce();
    expect(createWorkspace).toHaveBeenCalledWith('definition-A', 'A', config);
  });

  it('persists complete scenario corrections and refreshes the rotated workspace ETag', () => {
    const baseScenario = {
      id: 'scenario-A', workspaceId: 'workspace-A', scenarioKey: 'allow-create', name: 'Allow create',
      facts: { requestedAmount: 500 }, expectedDecision: 'ALLOW', expectedReasonCodes: [],
      expectedEffectIntents: [], status: 'ACTIVE', revision: 1, etag: 'scenario-etag-1'
    };
    createScenario.mockReturnValue(of({
      scenario: { ...baseScenario, expectedEffectIntents: ['REGISTER_EXTRAORDINARY_GRANT'] },
      workspace: {
        id: 'workspace-A', ruleKey: 'A', status: 'OPEN', etag: 'workspace-etag-2', revision: 2,
        condition: { '===': [1, 1] }, parameters: {}
      }
    }));
    updateScenario.mockReturnValue(of({
      scenario: {
        ...baseScenario, revision: 2, etag: 'scenario-etag-2',
        expectedEffectIntents: ['REGISTER_EXTRAORDINARY_GRANT']
      },
      workspace: {
        id: 'workspace-A', ruleKey: 'A', status: 'OPEN', etag: 'workspace-etag-3', revision: 3,
        condition: { '===': [1, 1] }, parameters: {}
      }
    }));

    component.select(decision('A'));
    capabilities.A[0].next({
      workspaceId: 'workspace-A', availableActions: ['VIEW', 'MANAGE_SCENARIOS'], blockers: []
    });
    component.createScenario(
      'allow-create', 'Allow create', '{"requestedAmount":500}', 'ALLOW', '', '',
      'REGISTER_EXTRAORDINARY_GRANT', document.createElement('form')
    );

    expect(createScenario).toHaveBeenCalledWith('workspace-A', expect.objectContaining({
      facts: { requestedAmount: 500 },
      expectedReasonCodes: [],
      expectedEffectIntents: ['REGISTER_EXTRAORDINARY_GRANT']
    }), config);
    expect(component.selected()?.workspaceEtag).toBe('workspace-etag-2');
    capabilities.A[1].next({
      workspaceId: 'workspace-A', availableActions: ['VIEW', 'MANAGE_SCENARIOS'], blockers: []
    });

    component.updateScenario(
      { ...baseScenario, expectedEffectIntents: [] } as any,
      'deny-update', 'Deny update', '{"requestedAmount":750}', 'DENY', 'DISABLED',
      '', '', 'REGISTER_EXTRAORDINARY_GRANT\nREGISTER_EXTRAORDINARY_GRANT'
    );
    expect(updateScenario).toHaveBeenCalledWith(
      'workspace-A', 'scenario-A', expect.objectContaining({
        scenarioKey: 'deny-update',
        name: 'Deny update',
        facts: { requestedAmount: 750 },
        expectedDecision: 'DENY',
        status: 'DISABLED',
        expectedEffectIntents: ['REGISTER_EXTRAORDINARY_GRANT']
      }), 'scenario-etag-1', config
    );
    expect(component.selected()?.workspaceEtag).toBe('workspace-etag-3');
    expect(component.sandboxRun()).toBeNull();
  });

  it('rejects invalid facts before updating a governed scenario', () => {
    component.select(decision('A'));
    capabilities.A[0].next({
      workspaceId: 'workspace-A', availableActions: ['VIEW', 'MANAGE_SCENARIOS'], blockers: []
    });

    component.updateScenario({
      id: 'scenario-A', workspaceId: 'workspace-A', scenarioKey: 'allow-create', name: 'Allow create',
      facts: { requestedAmount: 500 }, expectedDecision: 'ALLOW', status: 'ACTIVE',
      revision: 1, etag: 'scenario-etag-1'
    } as any, 'allow-create', 'Allow create', '[]', 'ALLOW', 'ACTIVE', '', '', '');

    expect(updateScenario).not.toHaveBeenCalled();
    expect(component.authoringError()).toBe(true);
    expect(component.authoringFeedback()).toBe('Facts JSON deve ser um objeto válido.');
  });

  it('builds the canonical nested scenario payload from governed fact descriptors', () => {
    component.select({
      ...decision('A'),
      facts: [
        { path: 'request.requestedAmount', valueType: 'number', nullable: false,
          label: 'Valor solicitado', description: 'Valor monetário.', providerRef: 'host:request',
          evidenceRefs: ['ruleset:A'], sensitivity: 'SENSITIVE', redaction: 'MASK' },
        { path: 'actor.permissions', valueType: 'string-array', nullable: false,
          label: 'Permissões', description: 'Permissões efetivas.', providerRef: 'host:principal',
          evidenceRefs: ['iam:A'], sensitivity: 'SECRET', redaction: 'OMIT' },
        { path: 'customer.additionalEligible', valueType: 'boolean', nullable: true,
          label: 'Elegibilidade adicional', description: 'Restrição opcional.', providerRef: 'host:customer',
          evidenceRefs: ['customer:A'], sensitivity: 'PERSONAL', redaction: 'MASK' }
      ]
    });

    component.setScenarioFactValue(component.selected()!.facts[0], '2500.50');
    component.setScenarioFactValue(component.selected()!.facts[1], 'benefit:request, benefit:review');
    component.setScenarioFactNull(component.selected()!.facts[2], true);

    expect(JSON.parse(component.scenarioFactsForSubmit())).toEqual({
      request: { requestedAmount: 2500.5 },
      actor: { permissions: ['benefit:request', 'benefit:review'] },
      customer: { additionalEligible: null }
    });
  });

  it('fails locally when expected output is invalid JSON', () => {
    component.select(decision('A'));
    capabilities.A[0].next({
      workspaceId: 'workspace-A', availableActions: ['VIEW', 'MANAGE_SCENARIOS'], blockers: []
    });

    component.createScenario(
      'invalid-output', 'Invalid output', '{}', 'ALLOW', '{broken', '', '',
      document.createElement('form')
    );

    expect(createScenario).not.toHaveBeenCalled();
    expect(component.authoringError()).toBe(true);
    expect(component.authoringFeedback()).toBe('O output esperado deve ser um JSON válido ou ficar vazio.');
  });

  it('requires an explicit operation and confirmation before invoking the discovered host action', () => {
    const action = {
      id: 'operational-proof', availability: { allowed: true }, title: 'Operational proof'
    };
    operationalTestAction.mockReturnValue(of(action));
    runOperationalTest.mockReturnValue(of({
      run: { runId: 'run-operational', workspaceId: 'workspace-A', workspaceRevision: 3, results: [] },
      workspaceEtag: 'etag-operational-3'
    }));

    component.select(decision('A'));
    component.scenarios.set([{ id: 'scenario-A', scenarioKey: 'allow-create' }] as any);
    component.reviewOperationalTest();
    expect(component.operationalConfirmationOpen()).toBe(false);

    component.setOperationalScenarioMode('scenario-A', 'CREATE');
    component.reviewOperationalTest();
    expect(component.operationalConfirmationOpen()).toBe(true);
    component.runOperationalTest();

    expect(runOperationalTest).toHaveBeenCalledOnce();
    expect(runOperationalTest.mock.calls[0][1]).toBe('workspace-A');
    expect(runOperationalTest.mock.calls[0][2]).toBe('etag-A');
    expect(runOperationalTest.mock.calls[0][3]).toEqual([
      { scenarioId: 'scenario-A', operationMode: 'CREATE' }
    ]);
    expect(component.selected()?.workspaceEtag).toBe('etag-operational-3');
    expect(component.selected()?.workspaceRevision).toBe(3);
  });

  it('reuses the operational command after an uncertain failure and rotates it after success', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-08-14T12:00:00.000Z'));
      const action = {
        id: 'operational-proof', availability: { allowed: true }, title: 'Operational proof'
      };
      const attempts: Subject<any>[] = [];
      operationalTestAction.mockReturnValue(of(action));
      runOperationalTest.mockImplementation(() => {
        const attempt = new Subject<any>();
        attempts.push(attempt);
        return attempt.asObservable();
      });

      component.select(decision('A'));
      component.scenarios.set([{ id: 'scenario-A', scenarioKey: 'allow-create' }] as any);
      component.setOperationalScenarioMode('scenario-A', 'CREATE');
      component.reviewOperationalTest();
      component.runOperationalTest();
      const firstKey = runOperationalTest.mock.calls[0][4];
      const firstEvaluatedAt = runOperationalTest.mock.calls[0][5];
      attempts[0].error(new Error('response lost after commit'));

      component.reviewOperationalTest();
      component.runOperationalTest();
      expect(runOperationalTest.mock.calls[1][4]).toBe(firstKey);
      expect(runOperationalTest.mock.calls[1][5]).toBe(firstEvaluatedAt);
      attempts[1].next({
        run: { runId: 'run-operational', workspaceId: 'workspace-A', workspaceRevision: 3, results: [] },
        workspaceEtag: 'etag-operational-3'
      });

      vi.advanceTimersByTime(1);
      component.reviewOperationalTest();
      component.runOperationalTest();
      expect(runOperationalTest.mock.calls[2][4]).not.toBe(firstKey);
      expect(runOperationalTest.mock.calls[2][5]).not.toBe(firstEvaluatedAt);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reuses the sandbox idempotency key after an uncertain failure and rotates it after success', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-08-14T12:00:00.000Z'));
      component.select(decision('A'));
      scenarios.A[0].next([
        { id: 'scenario-A', status: 'ACTIVE' },
        { id: 'scenario-disabled', status: 'DISABLED' }
      ]);
      capabilities.A[0].next({
        workspaceId: 'workspace-A', availableActions: ['VIEW', 'RECORD_TEST_RUN'], blockers: []
      });

      component.runGovernedSandbox();
      expect(runSandbox.mock.calls[0][1]).toEqual(['scenario-A']);
      const firstKey = runSandbox.mock.calls[0][2];
      const firstEvaluatedAt = runSandbox.mock.calls[0][3];
      sandboxRuns[0].error(new Error('response lost after dispatch'));

      component.runGovernedSandbox();
      expect(runSandbox.mock.calls[1][2]).toBe(firstKey);
      expect(runSandbox.mock.calls[1][3]).toBe(firstEvaluatedAt);
      sandboxRuns[1].next({ runId: 'run-A', workspaceId: 'workspace-A', results: [] });
      expect(capabilities.A).toHaveLength(2);
      capabilities.A[1].next({
        workspaceId: 'workspace-A', availableActions: ['VIEW', 'RECORD_TEST_RUN', 'SUBMIT'], blockers: []
      });
      expect(component.hasWorkspaceAction('SUBMIT')).toBe(true);

      vi.advanceTimersByTime(1);
      component.runGovernedSandbox();
      expect(runSandbox.mock.calls[2][2]).not.toBe(firstKey);
      expect(runSandbox.mock.calls[2][3]).not.toBe(firstEvaluatedAt);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores older success and error responses when the same resource is reloaded', () => {
    component.select(decision('A'));
    component.loadTimeline();
    component.loadLifecycle();
    component.loadScenarios();
    component.loadReviews();
    component.loadWorkspaceCapabilities();

    timelines.A[1].next([{ eventType: 'NEW', occurredAt: '2026-08-13T12:00:00Z', summary: 'new', status: null, actor: null }]);
    lifecycles.A[1].next({ workspaceStatus: 'NEW', workspaceRevision: 2, testRunCount: 1, reviewCount: 1, materializationCount: 0, promotedDefinitionId: null, submittedTestRunId: 'run-new', latestTestRun: null });
    scenarios.A[1].next([{ id: 'scenario-new' }]);
    reviews.A[1].next([{ id: 'review-new' }]);
    capabilities.A[1].next({ workspaceId: 'workspace-A', availableActions: ['VIEW', 'SUBMIT'], blockers: [] });

    timelines.A[0].next([{ eventType: 'OLD', occurredAt: '2026-08-13T11:00:00Z', summary: 'old', status: null, actor: null }]);
    lifecycles.A[0].next({ workspaceStatus: 'OLD', workspaceRevision: 1, testRunCount: 0, reviewCount: 0, materializationCount: 0, promotedDefinitionId: null, submittedTestRunId: null, latestTestRun: null });
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

  it('governs review rationale as reactive state and rejects blank review commands', () => {
    component.select(decision('A'));
    capabilities.A[0].next({
      workspaceId: 'workspace-A', availableActions: ['VIEW', 'REVIEW'], blockers: []
    });
    const form = document.createElement('form');

    component.reviewGovernedWorkspace('APPROVE', '   ', form);
    expect(reviewWorkspace).not.toHaveBeenCalled();

    reviewWorkspace.mockReturnValue(of({
      id: 'workspace-A', ruleKey: 'A', status: 'APPROVED', etag: 'etag-reviewed', revision: 3,
      parameters: {}
    }));
    component.reviewRationaleValue.set('  independent evidence accepted  ');
    component.reviewGovernedWorkspace('APPROVE', component.reviewRationaleValue(), form);

    expect(reviewWorkspace).toHaveBeenCalledWith(
      'workspace-A', 'etag-A', 'APPROVE', 'independent evidence accepted', config
    );
    expect(component.reviewRationaleValue()).toBe('');
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
