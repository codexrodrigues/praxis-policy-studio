import '@angular/compiler';
import type { DomainRuleRolloutCatalogItem, DomainRuleSnapshotVersion } from '@praxisui/core';
import { ElementRef } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
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

function snapshotVersion(overrides: Partial<DomainRuleSnapshotVersion> = {}): DomainRuleSnapshotVersion {
  return {
    snapshotKey: 'candidate-1', ruleSetKey: 'test-rules', ruleSetVersion: 1,
    publicationRevision: 1, snapshotContentHash: 'A'.repeat(64), publishedBy: 'publisher',
    publishedAtUtc: '2026-10-21T10:00:00Z', active: false,
    governanceState: 'READY', availableAction: 'ACTIVATE', ...overrides
  };
}

describe('CatalogWorkspaceComponent selection isolation', () => {
  const timelines = { A: [] as Subject<any>[], B: [] as Subject<any>[] };
  const lifecycles = { A: [] as Subject<any>[], B: [] as Subject<any>[] };
  const scenarios = { A: [] as Subject<any>[], B: [] as Subject<any>[] };
  const reviews = { A: [] as Subject<any>[], B: [] as Subject<any>[] };
  const capabilities = { A: [] as Subject<any>[], B: [] as Subject<any>[] };
  const createWorkspace = vi.fn();
  const createRollout = vi.fn();
  const saveWorkspaceDraft = vi.fn();
  const parameters = vi.fn();
  const runtimeState = vi.fn();
  const createScenario = vi.fn();
  const updateScenario = vi.fn();
  const reviewWorkspace = vi.fn();
  const cancelRollout = vi.fn();
  const activateRolloutCandidate = vi.fn();
  const operateSnapshot = vi.fn();
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
    createRollout.mockReset();
    saveWorkspaceDraft.mockReset();
    parameters.mockReset();
    runtimeState.mockReturnValue({ kind: 'ready', config });
    createScenario.mockReset();
    updateScenario.mockReset();
    reviewWorkspace.mockReset();
    cancelRollout.mockReset();
    activateRolloutCandidate.mockReset();
    operateSnapshot.mockReset();
    operationalTestAction.mockReset();
    runOperationalTest.mockReset();
    logoutSession.mockReset();
    logoutResult = new Subject<void>();
    logoutSession.mockReturnValue(logoutResult.asObservable());
    operationalTestAction.mockReturnValue(of(null));
    cancelRollout.mockReturnValue(of(void 0));
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
      { provide: RuntimeConfigService, useValue: { state: runtimeState, mode: () => 'fixture' } },
      { provide: ProjectionCatalogService, useValue: {
        timeline: (id: string) => stream(timelines, id),
        lifecycle: (id: string) => stream(lifecycles, id),
        scenarios: (id: string) => stream(scenarios, id),
        reviews: (id: string) => stream(reviews, id),
        workspaceCapabilities: (id: string) => stream(capabilities, id),
        operationalTestAction,
        runOperationalTest,
        createWorkspace,
        createRollout,
        saveWorkspaceDraft,
        parameters,
        createScenario,
        updateScenario,
        reviewWorkspace,
        cancelRollout,
        activateRolloutCandidate,
        operateSnapshot,
        runSandbox
      } }
    ] });
    component = TestBed.runInInjectionContext(() => new CatalogWorkspaceComponent(TestBed.inject(PolicyStudioI18n)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  function parameterizedDecision(): DecisionSummary {
    return { ...decision('A'), workspaceParameters: {
      parameterValues: { limit: 3000 }, nullSemantics: 'FAIL_CLOSED', metadata: { source: 'product' }
    } };
  }

  function allowParameterEditing(): void {
    capabilities.A[0].next({ workspaceId: 'workspace-A', availableActions: ['VIEW', 'UPDATE_DRAFT'], blockers: [] });
    component.parameterCatalog.set({ definitionId: 'definition-A', ruleKey: 'A', definitionVersion: 1,
      schemaVersion: 'praxis.domain-rule-parameter-catalog.v1', templateKey: 'product:limit', templateVersion: '1',
      parameters: [{ name: 'limit', type: 'NUMBER', required: true, nullable: true, readOnly: false,
        defaultValue: 3000, minimum: 0, maximum: 5000, origin: 'DECLARED', declaredValue: 3000, effectiveValue: 3000 }] });
    component.openAuthoring();
  }

  it('ignores stale parameter catalogs and fails closed on denied or mismatched catalogs', () => {
    const first = new Subject<unknown>();
    const second = new Subject<unknown>();
    parameters.mockReturnValueOnce(first).mockReturnValueOnce(second);
    component.select({ ...decision('A'), configVersion: 1 });
    runtimeState.mockReturnValue({ kind: 'ready', config: { ...config, mode: 'remote' } });
    component.loadParameters();
    runtimeState.mockReturnValue({ kind: 'ready', config });
    component.select({ ...decision('B'), configVersion: 1 });
    runtimeState.mockReturnValue({ kind: 'ready', config: { ...config, mode: 'remote' } });
    component.loadParameters();
    first.next({ definitionId: 'definition-A', ruleKey: 'A', definitionVersion: 1,
      schemaVersion: 'praxis.domain-rule-parameter-catalog.v1', templateKey: null, templateVersion: null, parameters: [] });
    expect(component.parameterCatalog()).toBeNull();
    expect(component.parameterCatalogState()).toBe('loading');
    second.error(new HttpErrorResponse({ status: 403 }));
    expect(component.parameterCatalogState()).toBe('forbidden');
    parameters.mockReturnValue(of({ definitionId: 'definition-B', ruleKey: 'B', definitionVersion: 2,
      schemaVersion: 'praxis.domain-rule-parameter-catalog.v1', templateKey: null, templateVersion: null, parameters: [] }));
    component.loadParameters();
    expect(component.parameterCatalogState()).toBe('failed');
    expect(component.parameterCatalog()).toBeNull();
  });

  it('saves parameters with the current ETag and immutable metadata, then reopens the server-derived draft', () => {
    const current = parameterizedDecision();
    component.allDecisions.set([current]);
    component.select(current);
    allowParameterEditing();
    component.updateDraft({ '===': [9, 9] });
    expect(component.draftCondition()).toEqual(current.condition);
    component.updateParameter({ name: 'limit', draft: { mode: 'VALUE', text: '2750' } });
    expect(component.draftChanged()).toBe(true);
    saveWorkspaceDraft.mockReturnValue(of({ id: 'workspace-A', ruleKey: 'A', status: 'OPEN', revision: 2,
      etag: 'etag-2', parameters: { ...current.workspaceParameters, parameterValues: { limit: 2750 } },
      condition: { '<=': [{ var: 'amount' }, 2750] } }));
    component.saveGovernedDraft();
    expect(saveWorkspaceDraft).toHaveBeenCalledWith({ id: 'workspace-A', etag: 'etag-A',
      parameters: { parameterValues: { limit: 2750 }, nullSemantics: 'FAIL_CLOSED', metadata: { source: 'product' } }
    }, null, config);
    expect(component.selected()?.workspaceEtag).toBe('etag-2');
    expect(component.draftCondition()).toEqual({ '<=': [{ var: 'amount' }, 2750] });
    expect(component.draftChanged()).toBe(false);
    component.closeAuthoring();
    component.openAuthoring();
    expect(component.parameterDrafts()['limit']).toEqual({ mode: 'VALUE', text: '2750' });
  });

  it('protects unsaved parameter changes and preserves explicit null versus omission', () => {
    component.select(parameterizedDecision());
    allowParameterEditing();
    component.updateParameter({ name: 'limit', draft: { mode: 'NULL', text: '' } });
    expect(component.parameterResolution().values).toEqual({ limit: null });
    component.select(decision('B'));
    expect(component.selected()?.key).toBe('A');
    expect(component.governedConfirmation()).not.toBeNull();
    component.updateParameter({ name: 'limit', draft: { mode: 'DEFAULT', text: '' } });
    expect(component.parameterResolution().values).toEqual({});
    expect(component.draftChanged()).toBe(true);
  });

  it('does not send parameterized rules through generic publication even if a stale capability offers it', () => {
    component.select({ ...parameterizedDecision(), promotedDefinitionId: 'promoted-A', availableDefinitionActions: ['PUBLISH'] });
    allowParameterEditing();
    component.publicationReadiness.set({ result: 'VALID', readiness: 'ready_to_publish', existingCoverage: [],
      predictedMaterializations: [], requiredApprovals: [], warnings: [], recommendedAction: null });
    component.inspectPublicationReadiness();
    component.publishGovernedDefinition();
    expect(component.authoringBusy()).toBe(false);
    // The catalog stub deliberately has no generic publication methods: calling
    // either generic endpoint would fail this test.
  });

  it('blocks invalid and readonly parameter changes and failed catalog saves', () => {
    component.select(parameterizedDecision());
    allowParameterEditing();
    component.updateParameter({ name: 'limit', draft: { mode: 'VALUE', text: '9000' } });
    component.saveGovernedDraft();
    expect(component.parameterErrors()['limit']).toBe('parameterAboveMaximum');
    expect(saveWorkspaceDraft).not.toHaveBeenCalled();
    component.parameterCatalog.update(catalog => ({ ...catalog!, parameters: catalog!.parameters.map(item => ({ ...item, readOnly: true })) }));
    component.updateParameter({ name: 'limit', draft: { mode: 'VALUE', text: '1000' } });
    expect(component.parameterDrafts()['limit'].text).toBe('9000');
    component.parameterCatalogState.set('failed');
    component.authoringOpen.set(false);
    component.openAuthoring();
    expect(component.authoringOpen()).toBe(false);
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

  it('offers a new sign-in after an unavailable catalog or a permission-limited session', () => {
    component.sessionActive.set(true);
    component.permissionLimited.set(true);
    component.loadError.set('PROJECTION_LOAD_FAILED');
    component.authenticationFailed.set(true);

    component.requestAuthentication();

    expect(component.authenticationRequired()).toBe(true);
    expect(component.sessionActive()).toBe(false);
    expect(component.permissionLimited()).toBe(false);
    expect(component.loadError()).toBeNull();
    expect(component.authenticationFailed()).toBe(false);
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
    expect(component.scenarioError()).toBe(true);
    expect(component.scenarioFeedback()).toBe('Facts JSON deve ser um objeto válido.');
    expect(component.authoringFeedback()).toBeNull();
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

    expect(JSON.parse(component.scenarioFactsJson())).toEqual({
      request: { requestedAmount: 2500.5 },
      actor: { permissions: ['benefit:request', 'benefit:review'] },
      customer: { additionalEligible: null }
    });
  });

  it('keeps a filtered-out selection explicit and restores the full catalog on request', () => {
    component.allDecisions.set([decision('A'), decision('B')]);
    component.select(decision('A'));

    component.updateQuery('B');

    expect(component.decisions().map(item => item.key)).toEqual(['B']);
    expect(component.selectionOutsideFilter()).toBe(true);

    component.clearQuery();

    expect(component.selectionOutsideFilter()).toBe(false);
    expect(component.decisions().map(item => item.key)).toEqual(['A', 'B']);
  });

  it('activates the requested work mode and moves focus without changing browser navigation', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(performance.now()), 0);
    });
    const host = TestBed.inject(ElementRef).nativeElement as HTMLElement;
    const target = document.createElement('section');
    target.id = 'decision-rule';
    target.tabIndex = -1;
    target.scrollIntoView = vi.fn();
    target.focus = vi.fn();
    host.append(target);

    component.navigateToSection('decision-rule');
    vi.runAllTimers();

    expect(component.activeMode()).toBe('rule');
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(target.focus).toHaveBeenCalledWith({ preventScroll: true });
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('preserves the governed draft while the operator changes work modes', () => {
    component.select({ ...decision('A'), workspaceId: 'workspace-A' });
    component.authoringOpen.set(true);
    component.draftCondition.set({ '<=': [{ var: 'request.requestedAmount' }, 2750] });

    component.activeMode.set('test');
    component.activeMode.set('rule');

    expect(component.authoringOpen()).toBe(true);
    expect(component.draftCondition()).toEqual({ '<=': [{ var: 'request.requestedAmount' }, 2750] });
  });

  it('opens authoring in the rule mode even when the operator was testing', () => {
    const host = TestBed.inject(ElementRef).nativeElement as HTMLElement;
    const editor = document.createElement('section');
    editor.className = 'draft-workspace';
    editor.tabIndex = -1;
    editor.focus = vi.fn();
    host.append(editor);
    component.select(decision('A'));
    component.workspaceCapabilities.set({ availableActions: ['VIEW'], blockers: [] } as any);
    component.activeMode.set('test');

    component.openAuthoringAndFocus();

    expect(component.authoringOpen()).toBe(true);
    expect(component.activeMode()).toBe('rule');
    expect(editor.focus).toHaveBeenCalled();
  });

  it('asks before discarding a changed scenario edit', () => {
    component.scenarios.set([{ id: 'scenario-A', name: 'Allow request' }] as any);
    component.editingScenarioId.set('scenario-A');
    component.editingScenarioDirty.set(true);

    component.cancelScenarioEdit();

    expect(component.governedConfirmation()).toEqual(expect.objectContaining({
      title: 'Alterações ainda não salvas',
      target: 'Allow request',
      confirmLabel: 'Descartar alterações',
      cancelLabel: 'Continuar editando'
    }));
    expect(component.editingScenarioId()).toBe('scenario-A');

    component.confirmGovernedOperation();

    expect(component.editingScenarioId()).toBeNull();
    expect(component.editingScenarioDirty()).toBe(false);
  });

  it('protects a dirty scenario when switching scenarios or decisions', () => {
    component.select(decision('A'));
    capabilities.A[0].next({
      workspaceId: 'workspace-A', availableActions: ['VIEW', 'MANAGE_SCENARIOS'], blockers: []
    });
    component.scenarios.set([
      { id: 'scenario-A', facts: {}, scenarioKey: 'A', name: 'A' },
      { id: 'scenario-B', facts: {}, scenarioKey: 'B', name: 'B' }
    ] as any);
    component.editScenario('scenario-A');
    component.markScenarioEditDirty();

    component.editScenario('scenario-B');

    expect(component.governedConfirmation()?.target).toBe('A');
    component.cancelGovernedOperation();
    expect(component.editingScenarioId()).toBe('scenario-A');

    component.select(decision('B'));

    expect(component.governedConfirmation()?.target).toBe('A');
    expect(component.editingScenarioId()).toBe('scenario-A');
    expect(component.selected()?.key).toBe('A');

    component.confirmGovernedOperation();

    expect(component.selected()?.key).toBe('B');
    expect(component.editingScenarioId()).toBeNull();
  });

  it('uses the governed confirmation before resetting a changed rule draft', () => {
    component.select(decision('A'));
    component.authoringOpen.set(true);
    component.draftCondition.set({ '===': [1, 2] });

    component.resetDraft();

    expect(component.governedConfirmation()).toEqual(expect.objectContaining({
      title: 'Alterações ainda não salvas', target: 'A'
    }));
    expect(component.draftCondition()).toEqual({ '===': [1, 2] });

    component.confirmGovernedOperation();

    expect(component.draftCondition()).toEqual({ '===': [1, 1] });
  });

  it('hydrates and serializes governed facts when editing an existing scenario', () => {
    component.select({
      ...decision('A'),
      facts: [{ path: 'request.amount', valueType: 'number', nullable: false,
        label: 'Amount', description: 'Requested amount', providerRef: 'host:request',
        evidenceRefs: [], sensitivity: 'NON_SENSITIVE', redaction: 'NONE' }]
    });
    capabilities.A[0].next({
      workspaceId: 'workspace-A', availableActions: ['VIEW', 'MANAGE_SCENARIOS'], blockers: []
    });
    component.scenarios.set([{
      id: 'scenario-A', facts: { request: { amount: 500 } }, scenarioKey: 'A', name: 'A'
    }] as any);

    component.editScenario('scenario-A');
    expect(component.editingScenarioFactDraft()['request.amount']).toBe(500);

    component.setEditingScenarioFactValue(component.selected()!.facts[0], '750');
    expect(JSON.parse(component.editingScenarioFactsJson())).toEqual({ request: { amount: 750 } });
    expect(component.editingScenarioDirty()).toBe(true);
  });

  it('ignores a workspace mutation response after the selected decision changes', () => {
    const response = new Subject<any>();
    createWorkspace.mockReturnValue(response.asObservable());
    component.select({
      ...decision('A'), workspaceId: undefined, workspaceEtag: undefined,
      availableDefinitionActions: ['CREATE_NEW_VERSION']
    });
    component.createWorkspace();
    component.select(decision('B'));

    response.next({
      id: 'workspace-A', ruleKey: 'A', status: 'OPEN', etag: 'late-etag', revision: 1,
      condition: { '===': [9, 9] }, parameters: {}
    });

    expect(component.selected()?.key).toBe('B');
    expect(component.draftCondition()).toEqual(decision('B').condition);
    expect(component.authoringBusy()).toBe(false);
  });

  it('preserves local state and requests reauthentication when a command receives 401', () => {
    const response = new Subject<any>();
    createWorkspace.mockReturnValue(response.asObservable());
    component.select({
      ...decision('A'), workspaceId: undefined, workspaceEtag: undefined,
      availableDefinitionActions: ['CREATE_NEW_VERSION']
    });
    component.createWorkspace();

    response.error(new HttpErrorResponse({ status: 401 }));

    expect(component.selected()?.key).toBe('A');
    expect(component.authenticationRequired()).toBe(true);
    expect(component.sessionActive()).toBe(false);
    expect(component.authoringFeedback()).toContain('sessão expirou');
  });

  it('does not offer snapshot or rollout operations for non-ready history, even when active', () => {
    component.snapshotHead.set({ headEtag: 'head-1' } as any);
    component.rolloutCatalog.set({ availableActions: ['CREATE_ROLLOUT'], rollouts: [] } as any);
    for (const governanceState of ['RUNTIME_INCOMPATIBLE', 'REPUBLICATION_REQUIRED', 'INVALID'] as const) {
      for (const active of [false, true]) {
        const version = snapshotVersion({
          snapshotKey: 'historical-1', governanceState, active, availableAction: 'UNAVAILABLE'
        });
        component.snapshotVersions.set([version]);
        component.createRollout(version.snapshotKey);
        component.operateSnapshot(version);
        expect(component.governedConfirmation()).toBeNull();
      }
    }
    expect(createRollout).not.toHaveBeenCalled();
    expect(operateSnapshot).not.toHaveBeenCalled();
  });

  it('starts a server-authorized bootstrap rollout using the observed absence', () => {
    component.rolloutCatalog.set({ availableActions: ['CREATE_ROLLOUT'], rollouts: [] } as any);
    component.snapshotVersions.set([snapshotVersion({ availableAction: 'CREATE_ROLLOUT' })]);
    createRollout.mockReturnValue(of({ rolloutId: 'bootstrap-1' }));

    component.createRollout('candidate-1');
    expect(component.governedConfirmation()?.target).toBe('candidate-1');
    component.confirmGovernedOperation();

    expect(createRollout).toHaveBeenCalledWith('candidate-1', null, config);
    expect(component.snapshotHead()).toBeNull();
  });

  it('does not reinterpret a missing head while its read is loading or failed', () => {
    component.rolloutCatalog.set({ availableActions: ['CREATE_ROLLOUT'], rollouts: [] } as any);
    component.snapshotVersions.set([snapshotVersion({ availableAction: 'CREATE_ROLLOUT' })]);
    component.snapshotsLoading.set(true);
    component.createRollout('candidate-1');
    expect(component.governedConfirmation()).toBeNull();
    component.snapshotsLoading.set(false);
    component.snapshotsError.set(true);
    component.createRollout('candidate-1');
    expect(component.governedConfirmation()).toBeNull();
    component.snapshotsError.set(false);
    component.rolloutLoading.set(true);
    component.createRollout('candidate-1');
    expect(component.governedConfirmation()).toBeNull();
    component.rolloutLoading.set(false);
    component.rolloutError.set(true);
    component.createRollout('candidate-1');
    expect(component.governedConfirmation()).toBeNull();
    expect(createRollout).not.toHaveBeenCalled();
  });

  it('does not replace confirmed absence with a head that appeared during confirmation', () => {
    component.rolloutCatalog.set({ availableActions: ['CREATE_ROLLOUT'], rollouts: [] } as any);
    component.snapshotVersions.set([snapshotVersion({ availableAction: 'CREATE_ROLLOUT' })]);
    component.createRollout('candidate-1');
    expect(component.governedConfirmation()).not.toBeNull();
    component.snapshotHead.set({ headEtag: 'new-head' } as any);
    component.snapshotVersions.set([snapshotVersion()]);

    component.confirmGovernedOperation();

    expect(createRollout).not.toHaveBeenCalled();
    expect(component.rolloutFeedbackError()).toBe(true);
    expect(component.rolloutFeedback()).toBe('O estado mudou. Revise o catálogo antes de confirmar novamente.');
  });

  it('does not refresh a confirmed existing head token for rollout or activation', () => {
    component.snapshotHead.set({ headEtag: 'head-1' } as any);
    component.rolloutCatalog.set({ availableActions: ['CREATE_ROLLOUT'], rollouts: [] } as any);
    component.snapshotVersions.set([snapshotVersion()]);
    component.createRollout('candidate-1');
    component.snapshotHead.set({ headEtag: 'head-2' } as any);
    component.confirmGovernedOperation();
    expect(createRollout).not.toHaveBeenCalled();
    expect(component.rolloutFeedbackError()).toBe(true);
    expect(component.rolloutFeedback()).toContain('O estado mudou.');

    component.operateSnapshot(snapshotVersion());
    component.snapshotHead.set({ headEtag: 'head-3' } as any);
    component.confirmGovernedOperation();
    expect(operateSnapshot).not.toHaveBeenCalled();
    expect(component.snapshotFeedbackError()).toBe(true);
    expect(component.snapshotFeedback()).toBe('O estado mudou. Revise o catálogo antes de confirmar novamente.');
  });

  it('revalidates candidate availability after rollout confirmation', () => {
    component.snapshotHead.set({ headEtag: 'head-1' } as any);
    component.rolloutCatalog.set({ availableActions: ['CREATE_ROLLOUT'], rollouts: [] } as any);
    const candidate = snapshotVersion();
    component.snapshotVersions.set([candidate]);
    component.createRollout(candidate.snapshotKey);
    expect(component.governedConfirmation()?.target).toBe(candidate.snapshotKey);
    component.snapshotVersions.set([{
      ...candidate, governanceState: 'RUNTIME_INCOMPATIBLE', availableAction: 'UNAVAILABLE'
    }]);

    component.confirmGovernedOperation();

    expect(createRollout).not.toHaveBeenCalled();
    expect(component.rolloutBusy()).toBe(false);
  });

  it('revalidates snapshot availability after activation confirmation', () => {
    component.snapshotHead.set({ headEtag: 'head-1' } as any);
    const candidate = snapshotVersion();
    component.snapshotVersions.set([candidate]);
    component.operateSnapshot(candidate);
    expect(component.governedConfirmation()?.target).toBe(candidate.snapshotKey);
    component.snapshotVersions.set([{
      ...candidate, governanceState: 'RUNTIME_INCOMPATIBLE', availableAction: 'UNAVAILABLE'
    }]);

    component.confirmGovernedOperation();

    expect(operateSnapshot).not.toHaveBeenCalled();
    expect(component.snapshotBusy()).toBe(false);
  });

  function readyBootstrapRollout(): DomainRuleRolloutCatalogItem {
    return {
      rollout: {
        rolloutId: 'bootstrap-1', ruleSetKey: 'test-rules', candidateSnapshotKey: 'candidate-1',
        candidateContentHash: 'A'.repeat(64), expectedActiveSnapshotKey: null, expectedHeadEtag: null,
        policyKey: 'host-quorum', policyVersion: 1, enforcementMode: 'REQUIRED', status: 'READY',
        createdAtUtc: '2026-10-21T12:00:00Z', expiresAtUtc: null
      },
      readiness: {
        rolloutId: 'bootstrap-1', ruleSetKey: 'test-rules', candidateSnapshotKey: 'candidate-1',
        status: 'READY', enforcementMode: 'REQUIRED', minimumFreshProbes: 1, minimumReadyRatio: 1,
        totalProbes: 1, readyProbes: 1, incompatibleProbes: 0, unavailableProbes: 0, staleProbes: 0,
        activationReady: true, staleBeforeUtc: '2026-10-21T11:58:00Z'
      },
      expectedHeadCurrent: true, expired: false, availableActions: ['ACTIVATE_CANDIDATE']
    };
  }

  it.each(['action', 'missing', 'rolloutId', 'ruleSetKey', 'candidateSnapshotKey', 'candidateContentHash',
    'expectedActiveSnapshotKey', 'expectedHeadEtag'] as const)(
    'rejects rollout activation when the confirmed %s changes and explains the conflict', field => {
      const item = readyBootstrapRollout();
      component.rolloutCatalog.set({ ruleSetKey: 'test-rules', availableActions: [], rollouts: [item] });
      component.activateRollout(item);
      expect(component.governedConfirmation()?.target).toBe('candidate-1');
      if (field === 'action') item.availableActions = [];
      else if (field === 'missing') component.rolloutCatalog.set({ ruleSetKey: 'test-rules', availableActions: [], rollouts: [] });
      else item.rollout[field] = 'changed-after-confirmation';

      component.confirmGovernedOperation();

      expect(activateRolloutCandidate).not.toHaveBeenCalled();
      expect(component.rolloutFeedbackError()).toBe(true);
      expect(component.rolloutFeedback()).toBe('O estado mudou. Revise o catálogo antes de confirmar novamente.');
      expect(component.rolloutBusy()).toBe(false);
    }
  );

  it('activates only the unchanged confirmed bootstrap rollout identity', () => {
    const item = readyBootstrapRollout();
    component.rolloutCatalog.set({ ruleSetKey: 'test-rules', availableActions: [], rollouts: [item] });
    activateRolloutCandidate.mockReturnValue(new Subject().asObservable());
    component.activateRollout(item);
    component.confirmGovernedOperation();
    expect(activateRolloutCandidate).toHaveBeenCalledWith(item, config);
    expect(component.rolloutBusy()).toBe(true);
  });

  it('requires the contextual governed dialog before cancelling a rollout', () => {
    const item = {
      rollout: { candidateSnapshotKey: 'snapshot-candidate', rolloutId: 'rollout-A' },
      availableActions: ['CANCEL']
    } as any;
    component.rolloutCatalog.set({ availableActions: [], rollouts: [item] } as any);

    component.cancelRollout(item);

    expect(cancelRollout).not.toHaveBeenCalled();
    expect(component.governedConfirmation()?.target).toBe('snapshot-candidate');
    expect(component.governedConfirmation()?.confirmLabel).toBe('Cancelar rollout');

    component.confirmGovernedOperation();

    expect(cancelRollout).toHaveBeenCalledWith(item, config);
    expect(component.governedConfirmation()).toBeNull();
  });

  it('fails closed when a governed action disappears while its dialog is open', () => {
    const item = {
      rollout: { candidateSnapshotKey: 'snapshot-candidate', rolloutId: 'rollout-A' },
      availableActions: ['CANCEL']
    } as any;
    component.rolloutCatalog.set({ availableActions: [], rollouts: [item] } as any);
    component.cancelRollout(item);
    component.rolloutCatalog.set({
      availableActions: [], rollouts: [{ ...item, availableActions: [] }]
    } as any);

    component.confirmGovernedOperation();

    expect(cancelRollout).not.toHaveBeenCalled();
    expect(component.rolloutBusy()).toBe(false);
  });

  it('returns to the narrow catalog without discarding the governed selection', () => {
    component.select(decision('A'));

    component.returnToCatalog();

    expect(component.narrowDetailOpen()).toBe(false);
    expect(component.selected()?.key).toBe('A');
  });

  it('only returns to the narrow catalog after explicitly discarding local work', () => {
    component.select(decision('A'));
    component.authoringOpen.set(true);
    component.draftCondition.set({ '===': [1, 2] });
    component.narrowDetailOpen.set(true);

    component.returnToCatalog();

    expect(component.narrowDetailOpen()).toBe(true);
    expect(component.authoringOpen()).toBe(true);
    expect(component.governedConfirmation()?.confirmLabel).toBe('Descartar alterações');

    component.confirmGovernedOperation();

    expect(component.narrowDetailOpen()).toBe(false);
    expect(component.authoringOpen()).toBe(false);
    expect(component.draftCondition()).toEqual({ '===': [1, 1] });
    expect(component.selected()?.key).toBe('A');
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
    expect(component.scenarioError()).toBe(true);
    expect(component.scenarioFeedback()).toBe('O output esperado deve ser um JSON válido ou ficar vazio.');
    expect(component.authoringFeedback()).toBeNull();
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

  it('translates governed outcomes and lifecycle states without changing their canonical values', () => {
    expect(component.decisionOutcomeLabel('ALLOW')).toBe('Permitida');
    expect(component.decisionOutcomeLabel('TECHNICAL_ERROR')).toBe('Erro técnico');
    expect(component.scenarioStatusLabel('ACTIVE')).toBe('Ativo');
    expect(component.workspaceStatusLabel('SUBMITTED')).toBe('Em revisão');
    expect(component.comparisonLabel('CANDIDATE_MATCH')).toBe('Resultado esperado confirmado');
    expect(component.comparisonLabel('CANDIDATE_MISMATCH')).toBe('Resultado diferente do esperado');
  });

  it('compares the local authoring candidate instead of the last saved workspace condition', () => {
    component.select({
      ...decision('A'),
      condition: { '<=': [{ var: 'amount' }, 3000] },
      workspaceCondition: { '<=': [{ var: 'amount' }, 2900] }
    });
    component.authoringOpen.set(true);
    component.draftCondition.set({ '<=': [{ var: 'amount' }, 2750] });

    expect(component.semanticDiff()).toContainEqual(expect.objectContaining({
      path: '$.<=[1]', baseline: 3000, candidate: 2750
    }));
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
