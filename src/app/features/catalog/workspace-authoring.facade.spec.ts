import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PolicyStudioI18n } from '../../core/i18n';
import { ProjectionCatalogService } from '../../core/projection-catalog.service';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import type { DecisionSummary } from './catalog.fixture';
import { CatalogSelectionStore } from './catalog-selection.store';
import { ScenarioSandboxFacade } from './scenario-sandbox.facade';
import { SnapshotExecutionFacade } from './snapshot-execution.facade';
import { WorkspaceAuthoringFacade } from './workspace-authoring.facade';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

const remoteConfig = {
  mode: 'remote' as const,
  configApiBaseUrl: 'http://localhost:8088',
  locale: 'pt-BR' as const,
  projectionPath: null,
  initialDecisionKey: null
};

function makeDecision(overrides: Partial<DecisionSummary> = {}): DecisionSummary {
  return {
    order: 1,
    totalDecisions: 1,
    key: 'workforce.leave.max-days',
    code: 'WF-00010',
    name: 'Limite de afastamento',
    domain: 'workforce',
    ruleSet: 'Workforce Leave Rules',
    ruleSetKey: 'workforce.leave-requests',
    resourceKey: 'workforce.leave-requests',
    serviceKey: 'workforce-service',
    state: 'verified',
    meaning: 'Controla o limite máximo de dias.',
    authority: 'CONFIG',
    baselineAuthority: 'SYNTHETIC',
    source: 'definition:1',
    evidenceCount: 0,
    authoringSupported: true,
    availableDefinitionActions: ['PUBLISH'],
    configDefinitionId: 'def-1',
    configStatus: 'draft',
    workspaceId: 'ws-1',
    workspaceStatus: 'OPEN',
    workspaceEtag: 'etag-1',
    workspaceRevision: 1,
    expression: null,
    condition: null,
    factPaths: [],
    facts: [],
    nullSemantics: 'FAIL_CLOSED',
    operationKeys: ['CREATE'],
    hostContractVersion: '1.0',
    evidence: [],
    draftLifecycle: 'REFERENCE_DRAFT_ONLY',
    parameters: {},
    workspaceParameters: {},
    ...overrides
  };
}

describe('WorkspaceAuthoringFacade didactic documentation flow', () => {
  const saveWorkspaceDraft = vi.fn();
  const publishDefinition = vi.fn();
  const inspectPublicationReadiness = vi.fn();
  const loadCatalog = vi.fn();
  let facade: WorkspaceAuthoringFacade;
  let store: CatalogSelectionStore;

  beforeEach(() => {
    saveWorkspaceDraft.mockReset();
    publishDefinition.mockReset();
    inspectPublicationReadiness.mockReset();
    loadCatalog.mockReset();
    loadCatalog.mockReturnValue(of([]));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PolicyStudioI18n,
        CatalogSelectionStore,
        WorkspaceAuthoringFacade,
        { provide: RuntimeConfigService, useValue: { state: () => ({ kind: 'ready', config: remoteConfig }), mode: () => 'remote' } },
        { provide: ScenarioSandboxFacade, useValue: { resetSandboxState: vi.fn(), loadScenarios: vi.fn() } },
        { provide: SnapshotExecutionFacade, useValue: { loadSnapshots: vi.fn() } },
        {
          provide: ProjectionCatalogService,
          useValue: {
            saveWorkspaceDraft,
            publishDefinition,
            inspectPublicationReadiness,
            load: loadCatalog,
            overlayParameterCatalog: (cat: unknown) => cat,
            reviews: () => of([]),
            lifecycle: () => of(null),
            workspaceCapabilities: () => of({ workspaceId: 'ws-1', availableActions: ['VIEW', 'UPDATE_DRAFT'], blockers: [] }),
            timeline: () => of([]),
            definitionActions: () => of([])
          }
        }
      ]
    });
    facade = TestBed.inject(WorkspaceAuthoringFacade);
    store = TestBed.inject(CatalogSelectionStore);
  });

  it('opens authoring on conditionless rules, tracks $.documentation semanticDiff, and sends {} when clearing docs', () => {
    const initialDoc = {
      title: 'Título inicial',
      summary: 'Resumo inicial',
      whenApplies: 'Na criação',
      rationale: 'Controle interno',
      customizationGuidance: 'Ajustar via Studio',
      legalBasis: [{ code: 'Lei 1/2020', article: 'Art. 2º' }]
    };
    const decision = makeDecision({
      condition: null,
      parameters: {},
      definitionDocumentation: initialDoc,
      workspaceDocumentation: initialDoc,
      documentation: initialDoc
    });
    store.allDecisions.set([decision]);
    store.selected.set(decision);
    store.workspaceCapabilities.set({
      workspaceId: 'ws-1',
      ruleKey: decision.key,
      status: 'OPEN',
      revision: 1,
      etag: 'etag-1',
      availableActions: ['VIEW', 'UPDATE_DRAFT'],
      blockers: []
    });

    expect(facade.canOpenAuthoring(decision)).toBe(true);
    facade.openAuthoring();
    expect(facade.authoringOpen()).toBe(true);
    expect(facade.draftChanged()).toBe(false);

    // Editing only documentation marks draftChanged and produces $.documentation diff
    facade.updateDraftDocumentation({
      ...initialDoc,
      summary: 'Resumo atualizado pelo gestor'
    });
    expect(facade.draftDocumentationChanged()).toBe(true);
    expect(facade.draftChanged()).toBe(true);
    expect(facade.semanticDiff()).toEqual([
      expect.objectContaining({
        path: '$.documentation.summary',
        kind: 'CHANGED',
        baseline: 'Resumo inicial',
        candidate: 'Resumo atualizado pelo gestor'
      })
    ]);

    // Validation errors block saveGovernedDraft
    facade.documentationValidationErrors.set(['title exceeds 255 characters']);
    facade.saveGovernedDraft();
    expect(saveWorkspaceDraft).not.toHaveBeenCalled();

    // Valid save passes 5th argument to saveWorkspaceDraft
    facade.documentationValidationErrors.set([]);
    saveWorkspaceDraft.mockReturnValue(of({
      id: 'ws-1',
      ruleKey: decision.key,
      status: 'OPEN',
      etag: 'etag-2',
      revision: 2,
      condition: null,
      parameters: {},
      documentation: {
        ...initialDoc,
        summary: 'Resumo atualizado pelo gestor'
      }
    }));
    facade.saveGovernedDraft();
    expect(saveWorkspaceDraft).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ws-1', etag: 'etag-1' }),
      null,
      remoteConfig,
      {},
      expect.objectContaining({ summary: 'Resumo atualizado pelo gestor' })
    );
    expect(facade.draftDocumentationChanged()).toBe(false);

    // Clearing documentation sends {} (not null, not omitted) so M1 backend clears draftDocumentation
    facade.updateDraftDocumentation(null);
    expect(facade.draftDocumentationChanged()).toBe(true);
    saveWorkspaceDraft.mockReturnValueOnce(of({
      id: 'ws-1',
      ruleKey: decision.key,
      status: 'OPEN',
      etag: 'etag-3',
      revision: 3,
      condition: null,
      parameters: {},
      documentation: null
    }));
    facade.saveGovernedDraft();
    expect(saveWorkspaceDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'ws-1', etag: 'etag-2' }),
      null,
      remoteConfig,
      {},
      {}
    );
    expect(store.selected()?.workspaceDocumentation).toBeNull();
    expect(facade.effectiveDocumentation(store.selected())).toBeNull();
  });

  it('refreshes catalog and configStatus on publishGovernedDefinition in remote mode', () => {
    const promoted = makeDecision({
      promotedDefinitionId: 'def-promoted-2',
      availableDefinitionActions: ['PUBLISH']
    });
    const refreshed = makeDecision({
      configDefinitionId: 'def-promoted-2',
      configStatus: 'active',
      documentation: { title: 'Título publicado' }
    });
    store.allDecisions.set([promoted]);
    store.selected.set(promoted);
    inspectPublicationReadiness.mockReturnValue(of({
      result: 'pass',
      readiness: 'ready_to_publish',
      existingCoverage: [],
      predictedMaterializations: [],
      requiredApprovals: [],
      warnings: [],
      recommendedAction: null
    }));
    publishDefinition.mockReturnValue(of({
      status: 'published',
      readiness: 'ready_to_publish',
      materializationCount: 1,
      outcomes: []
    }));
    loadCatalog.mockReturnValue(of([refreshed]));

    facade.publishGovernedDefinition();

    expect(loadCatalog).toHaveBeenCalledWith('pt-BR', expect.objectContaining({
      mode: 'remote',
      initialDecisionKey: promoted.key
    }));
    expect(store.selected()?.configStatus).toBe('active');
    expect(store.selected()?.documentation?.title).toBe('Título publicado');
  });
});
