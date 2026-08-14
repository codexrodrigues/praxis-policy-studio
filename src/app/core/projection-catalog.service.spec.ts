import '@angular/compiler';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { API_URL } from '@praxisui/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProjectionCatalogService } from './projection-catalog.service';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

const projection = {
  kind: 'POLICY_STUDIO_PROJECTION_V1',
  projectionId: 'quickstart.test.rules',
  projectionVersion: 1,
  sourceArtifacts: [{ path: 'rule-set.java', kind: 'RULESET_DEFINITION', sha256: 'A'.repeat(64) }],
  ruleSetRef: {
    domainKey: 'workforce-benefits', boundedContextKey: 'extraordinary-assistance',
    ruleSetKey: 'extraordinary-grant-eligibility', operationKeys: ['evaluate-extraordinary-grant']
  },
  decisionRefs: [{
    order: 1, decisionKey: 'grant.amount-parameters', reasonCode: 'LIMIT', presentationLabel: 'Amount limit',
    semanticStatus: 'REFERENCE_IMPLEMENTED', reviewStatus: 'REFERENCE_CASE', semanticSourceRef: 'factory#limit',
    targetPlanRef: 'golden#limit', editable: true, factPaths: ['request.requestedAmount']
  }],
  factSchemas: [{
    path: 'request.requestedAmount', valueType: 'number', nullable: false, presentationLabel: 'Amount',
    description: 'Requested amount.', locale: 'en-US', providerRef: 'request.amount', evidenceRefs: ['rule-set.java']
  }],
  configDefinitionRefs: { status: 'NOT_RESOLVED', definitionIds: [] },
  presentationLabels: {
    domain: { 'en-US': 'Workforce benefits' }, ruleSet: { 'en-US': 'Extraordinary grant eligibility' }
  },
  evidenceBoundaries: [{ boundary: 'REFERENCE', operations: ['evaluate-extraordinary-grant'], status: 'PROVED' }],
  authorityEvidence: {
    currentAuthority: 'QUICKSTART_GOVERNED_SNAPSHOT', baselineAuthority: 'SYNTHETIC_REFERENCE_BASELINE',
    productionAuthorityChanged: false
  }
};

describe('ProjectionCatalogService', () => {
  let service: ProjectionCatalogService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: API_URL, useValue: { default: { baseUrl: '' } } }
    ] });
    service = TestBed.inject(ProjectionCatalogService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('uses the public same-origin client and selects the highest governed version', () => {
    let decisions: readonly import('../features/catalog/catalog.fixture').DecisionSummary[] = [];
    service.load('/projections/reference.json', 'en-US', {
      mode: 'remote', configApiBaseUrl: '', locale: 'en-US',
      projectionPath: '/projections/reference.json', initialDecisionKey: null
    }).subscribe(value => decisions = value);

    http.expectOne('/projections/reference.json').flush(projection);
    const definitions = http.expectOne('/api/praxis/config/domain-rules/definitions');
    expect(definitions.request.withCredentials).toBe(false);
    http.expectOne('/api/praxis/config/domain-rules/workspaces').flush([{
      id: 'workspace-1', ruleKey: 'grant.amount-parameters', status: 'APPROVED', updatedAt: '2026-08-13T10:00:00Z'
    }]);
    definitions.flush([
      { id: 'v1', ruleKey: 'grant.amount-parameters', version: 1, status: 'draft', condition: { '===': [1, 1] } },
      {
        id: 'v2', ruleKey: 'grant.amount-parameters', version: 2, status: 'approved',
        condition: { '<=': [{ var: 'request.requestedAmount' }, 3000] },
        parameters: { nullSemantics: 'FAIL_CLOSED', operationKeys: ['evaluate-extraordinary-grant'] },
        governance: { lifecycleBoundary: 'REFERENCE_DRAFT_ONLY' }
      }
    ]);
    http.expectOne('/api/praxis/config/domain-rules/definitions/v2').flush({
      id: 'v2', ruleKey: 'grant.amount-parameters', version: 2, status: 'approved',
      condition: { '<=': [{ var: 'request.requestedAmount' }, 3000] },
      parameters: { nullSemantics: 'FAIL_CLOSED', operationKeys: ['evaluate-extraordinary-grant'] },
      governance: { lifecycleBoundary: 'REFERENCE_DRAFT_ONLY' }
    });

    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.configDefinitionId).toBe('v2');
    expect(decisions[0]?.configStatus).toBe('approved');
    expect(decisions[0]?.ruleSetKey).toBe('extraordinary-grant-eligibility');
    expect(decisions[0]?.workspaceId).toBe('workspace-1');
    expect(decisions[0]?.condition).toEqual({ '<=': [{ var: 'request.requestedAmount' }, 3000] });
  });

  it('composes lifecycle evidence through the public Core client', () => {
    let lifecycle: import('../features/catalog/catalog.fixture').DecisionLifecycleSummary | null = null;
    service.lifecycle('workspace 1', {
      mode: 'remote', configApiBaseUrl: '', locale: 'en-US',
      projectionPath: '/projections/reference.json', initialDecisionKey: null
    }).subscribe(value => lifecycle = value);

    http.expectOne('/api/praxis/config/domain-rules/workspaces/workspace%201').flush({
      id: 'workspace 1', status: 'APPROVED', revision: 4, promotedDefinitionId: null
    });
    http.expectOne('/api/praxis/config/domain-rules/workspaces/workspace%201/test-runs').flush([{ runId: 'run-1' }]);
    http.expectOne('/api/praxis/config/domain-rules/workspaces/workspace%201/reviews').flush([{ id: 'review-1' }]);
    expect(lifecycle).toEqual(expect.objectContaining({
      workspaceStatus: 'APPROVED', workspaceRevision: 4, testRunCount: 1,
      reviewCount: 1
    }));
  });

  it('loads workspace actions and blockers from the public Core client', () => {
    const config = {
      mode: 'remote' as const, configApiBaseUrl: '', locale: 'en-US' as const,
      projectionPath: '/projections/reference.json', initialDecisionKey: null
    };
    service.workspaceCapabilities('workspace 1', config).subscribe(capabilities => {
      expect(capabilities.availableActions).toEqual(['VIEW', 'SUBMIT']);
      expect(capabilities.blockers[0]?.code).toBe('TEST_RUN_NOT_PASSING');
    });

    const request = http.expectOne(
      '/api/praxis/config/domain-rules/workspaces/workspace%201/capabilities'
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      workspaceId: 'workspace 1', ruleKey: 'grant.amount-parameters', status: 'OPEN', revision: 2,
      etag: 'etag-2', availableActions: ['VIEW', 'SUBMIT'],
      blockers: [{ code: 'TEST_RUN_NOT_PASSING', action: 'SUBMIT', message: 'Passing evidence required.' }]
    });
  });

  it('loads the safe snapshot catalog, tolerates an absent head, and preserves strong head concurrency', () => {
    const config = {
      mode: 'remote' as const, configApiBaseUrl: '', locale: 'en-US' as const,
      projectionPath: '/projections/reference.json', initialDecisionKey: null
    };
    let cockpit: { head: unknown; versions: readonly unknown[] } | null = null;
    service.snapshotCockpit('benefit rules', config).subscribe(value => cockpit = value);

    const head = http.expectOne(request => request.url.endsWith('/domain-rules/snapshots/head/status'));
    expect(head.request.params.get('ruleSetKey')).toBe('benefit rules');
    head.flush({}, { status: 404, statusText: 'Not Found' });
    const versions = http.expectOne(request => request.url.endsWith('/domain-rules/snapshots'));
    expect(versions.request.params.get('ruleSetKey')).toBe('benefit rules');
    expect(versions.request.params.get('limit')).toBe('50');
    versions.flush([{ snapshotKey: 'snapshot-1', availableAction: 'ACTIVATE' }]);
    expect(cockpit).toEqual({ head: null, versions: [{ snapshotKey: 'snapshot-1', availableAction: 'ACTIVATE' }] });

    service.operateSnapshot({ snapshotKey: 'snapshot 1', availableAction: 'ACTIVATE' }, 'head-7', config).subscribe();
    const activate = http.expectOne('/api/praxis/config/domain-rules/snapshots/snapshot%201/activate');
    expect(activate.request.method).toBe('POST');
    expect(activate.request.headers.get('If-Match')).toBe('"head-7"');
    activate.flush({ activationType: 'ACTIVATED', headEtag: 'head-8' });

    service.operateSnapshot({ snapshotKey: 'snapshot 0', availableAction: 'ROLLBACK' }, 'head-8', config).subscribe();
    const rollback = http.expectOne('/api/praxis/config/domain-rules/snapshots/snapshot%200/rollback');
    expect(rollback.request.method).toBe('POST');
    expect(rollback.request.headers.get('If-Match')).toBe('"head-8"');
    rollback.flush({ activationType: 'ROLLED_BACK', headEtag: 'head-9' });
  });

  it('loads the redacted execution summary through the public Core client', () => {
    const config = {
      mode: 'remote' as const, configApiBaseUrl: '', locale: 'en-US' as const,
      projectionPath: '/projections/reference.json', initialDecisionKey: null
    };
    service.executionSummary('snapshot/1', config).subscribe(summary => {
      expect(summary.totalObservations).toBe(3);
      expect(summary.outcomeCounts.ALLOW).toBe(2);
    });
    const request = http.expectOne(
      '/api/praxis/config/domain-rules/snapshots/snapshot%2F1/execution-summary'
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      ruleSetKey: 'benefit-rules', snapshotKey: 'snapshot/1', snapshotContentHash: 'A'.repeat(64),
      ruleSetVersion: 1, totalObservations: 3, distinctHosts: 1,
      outcomeCounts: { ALLOW: 2, DENY: 1, NOT_APPLICABLE: 0, INCONCLUSIVE: 0, TECHNICAL_ERROR: 0 },
      firstObservedAtUtc: '2026-08-13T12:00:00Z', lastObservedAtUtc: '2026-08-13T12:05:00Z'
    });
  });

  it('loads the safe active-head host alignment aggregate through the public Core client', () => {
    const config = {
      mode: 'remote' as const, configApiBaseUrl: '', locale: 'en-US' as const,
      projectionPath: '/projections/reference.json', initialDecisionKey: null
    };
    service.hostStatusSummary('benefit/rules', config).subscribe(summary => {
      expect(summary.alignedHosts).toBe(2);
      expect(summary.incompatibleHosts).toBe(1);
    });
    const request = http.expectOne(candidate =>
      candidate.url === '/api/praxis/config/domain-rules/snapshots/head/host-status-summary'
      && candidate.params.get('ruleSetKey') === 'benefit/rules');
    expect(request.request.method).toBe('GET');
    request.flush({
      ruleSetKey: 'benefit/rules', expectedSnapshotKey: 'snapshot-2',
      expectedSnapshotContentHash: 'A'.repeat(64), expectedActivationRevision: 7,
      expectedHostContractVersion: 'quickstart/1.0', expectedEngineContractVersion: '1.4',
      expectedJsonLogicDialectVersion: 'praxis-json-logic/1.0',
      expectedJsonLogicCorpusSha256: 'B'.repeat(64), expectedImplementationCatalogDigest: 'C'.repeat(64),
      totalHosts: 4, alignedHosts: 2, snapshotDriftedHosts: 1, incompatibleHosts: 1,
      unavailableHosts: 0, staleHosts: 0,
      lastObservedAtUtc: '2026-08-13T12:05:00Z', staleBeforeUtc: '2026-08-13T12:03:00Z'
    });
  });

  it('persists a draft with ETag, creates a scenario, runs the host sandbox, and submits', () => {
    const config = {
      mode: 'remote' as const, configApiBaseUrl: '', locale: 'en-US' as const,
      projectionPath: '/projections/reference.json', initialDecisionKey: null
    };

    service.createWorkspace('definition-1', 'Eligibility change', config).subscribe();
    const create = http.expectOne('/api/praxis/config/domain-rules/workspaces');
    expect(create.request.method).toBe('POST');
    create.flush({ id: 'workspace-1', etag: 'etag-1', parameters: {} });

    service.saveWorkspaceDraft({ id: 'workspace-1', etag: 'etag-1', parameters: {} },
      { '>': [{ var: 'amount' }, 0] }, config).subscribe();
    const save = http.expectOne('/api/praxis/config/domain-rules/workspaces/workspace-1/draft');
    expect(save.request.headers.get('If-Match')).toBe('"etag-1"');
    expect(save.request.body.condition).toEqual({ '>': [{ var: 'amount' }, 0] });
    save.flush({ id: 'workspace-1', etag: 'etag-2', parameters: {} });

    service.createScenario('workspace-1', {
      scenarioKey: 'positive', name: 'Positive amount', facts: { amount: 10 }, expectedDecision: 'ALLOW'
    }, config).subscribe();
    const scenario = http.expectOne('/api/praxis/config/domain-rules/workspaces/workspace-1/scenarios');
    expect(scenario.request.method).toBe('POST');
    scenario.flush({ id: 'scenario-1', expectedDecision: 'ALLOW' });

    service.runSandbox('workspace-1', ['scenario-1'], config).subscribe();
    const sandbox = http.expectOne('/api/praxis/policy-studio/sandbox/runs');
    expect(sandbox.request.body).toEqual(expect.objectContaining({
      workspaceId: 'workspace-1', scenarioIds: ['scenario-1']
    }));
    sandbox.flush({ runId: 'run-1', workspaceId: 'workspace-1', results: [] });

    service.submitWorkspace('workspace-1', 'etag-2', config).subscribe();
    const submit = http.expectOne('/api/praxis/config/domain-rules/workspaces/workspace-1/submit');
    expect(submit.request.headers.get('If-Match')).toBe('"etag-2"');
    submit.flush({ id: 'workspace-1', status: 'SUBMITTED' });
  });

  it('loads independent reviews, records a maker-checker decision, and promotes through Core', () => {
    const config = {
      mode: 'remote' as const, configApiBaseUrl: '', locale: 'en-US' as const,
      projectionPath: '/projections/reference.json', initialDecisionKey: null
    };

    service.reviews('workspace-1', config).subscribe();
    const reviews = http.expectOne('/api/praxis/config/domain-rules/workspaces/workspace-1/reviews');
    expect(reviews.request.method).toBe('GET');
    reviews.flush([{ id: 'review-1', decision: 'APPROVE', rationale: 'Evidence is complete.' }]);

    service.reviewWorkspace('workspace-1', 'etag-submitted', 'APPROVE', 'Evidence is complete.', config).subscribe();
    const review = http.expectOne('/api/praxis/config/domain-rules/workspaces/workspace-1/reviews');
    expect(review.request.headers.get('If-Match')).toBe('"etag-submitted"');
    expect(review.request.body).toEqual({ decision: 'APPROVE', rationale: 'Evidence is complete.' });
    review.flush({ id: 'review-1', decision: 'APPROVE' });
    http.expectOne('/api/praxis/config/domain-rules/workspaces/workspace-1').flush({
      id: 'workspace-1', status: 'APPROVED', etag: 'etag-approved'
    });

    service.promoteWorkspace('workspace-1', 'etag-approved', config).subscribe();
    const promote = http.expectOne('/api/praxis/config/domain-rules/workspaces/workspace-1/promote');
    expect(promote.request.headers.get('If-Match')).toBe('"etag-approved"');
    promote.flush({ id: 'workspace-1', status: 'PROMOTED' });
  });

  it('inspects structural readiness and publishes through the canonical Config client', () => {
    const config = {
      mode: 'remote' as const, configApiBaseUrl: '', locale: 'en-US' as const,
      projectionPath: '/projections/reference.json', initialDecisionKey: null
    };

    service.inspectPublicationReadiness('definition-2', config).subscribe(value => {
      expect(value.readiness).toBe('ready_to_publish');
      expect(value.predictedMaterializations).toHaveLength(1);
    });
    const simulation = http.expectOne('/api/praxis/config/domain-rules/simulations');
    expect(simulation.request.body).toEqual({ ruleDefinitionId: 'definition-2' });
    simulation.flush({
      result: 'pass', predictedMaterializations: [{ targetLayer: 'option_source' }],
      requiredApprovals: [], warnings: [], existingCoverage: [],
      explainability: { publicationReadiness: 'ready_to_publish', recommendedAction: 'publish' }
    });

    service.publishDefinition('definition-2', config).subscribe(value => {
      expect(value.status).toBe('published');
      expect(value.materializationCount).toBe(1);
    });
    const publication = http.expectOne('/api/praxis/config/domain-rules/publications');
    expect(publication.request.body).toEqual(expect.objectContaining({
      ruleDefinitionId: 'definition-2', applyEligibleMaterializations: true
    }));
    publication.flush({
      publicationStatus: 'published', publicationReadiness: 'ready_to_publish',
      materializations: [{ id: 'materialization-1' }],
      explainability: { publicationDiagnostics: { materializationOutcomes: [{ resolution: 'created' }] } }
    });
  });
});
