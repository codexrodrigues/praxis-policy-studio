import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSessionService } from './auth-session.service';
import { GovernedHostScopeService } from './governed-host-scope.service';
import { PolicyStudioI18n } from './i18n';
import { ProjectionCatalogService } from './projection-catalog.service';
import { RuntimeConfigService } from './runtime-config.service';
import { StudioCapabilitiesService } from './studio-capabilities.service';
import { StudioCatalogBootstrapService } from './studio-catalog-bootstrap.service';
import { StudioShellStateService } from './studio-shell-state.service';
import { CatalogSelectionStore } from '../features/catalog/catalog-selection.store';
import type { DecisionSummary } from '../features/catalog/catalog.fixture';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

function decision(key: string): DecisionSummary {
  return {
    order: 1,
    totalDecisions: 2,
    key,
    code: key.toUpperCase(),
    name: `Rule ${key}`,
    domain: 'workforce.attendance',
    ruleSet: 'workforce.attendance.launch',
    ruleSetKey: 'workforce.attendance.launch',
    resourceKey: 'workforce.attendance',
    serviceKey: 'attendance-service',
    state: 'verified',
    meaning: `Meaning ${key}`,
    authority: 'CONFIG_AUTHORITATIVE',
    baselineAuthority: 'CONFIG',
    source: 'config',
    evidenceCount: 1,
    authoringSupported: true,
    availableDefinitionActions: [],
    expression: null,
    condition: null,
    factPaths: [],
    facts: [],
    nullSemantics: 'FAIL_CLOSED',
    operationKeys: ['CREATE'],
    hostContractVersion: '1.0',
    evidence: [],
    draftLifecycle: null
  };
}

describe('StudioCatalogBootstrapService', () => {
  const loadCatalogSpy = vi.fn();
  const logoutSpy = vi.fn();
  const hasSessionSpy = vi.fn();

  beforeEach(() => {
    loadCatalogSpy.mockReset();
    logoutSpy.mockReset();
    hasSessionSpy.mockReset();
    logoutSpy.mockReturnValue(of(void 0));
    hasSessionSpy.mockReturnValue(of(true));

    TestBed.configureTestingModule({
      providers: [
        PolicyStudioI18n,
        GovernedHostScopeService,
        StudioShellStateService,
        StudioCapabilitiesService,
        CatalogSelectionStore,
        StudioCatalogBootstrapService,
        {
          provide: ProjectionCatalogService,
          useValue: { load: loadCatalogSpy, invalidateCatalogMetaCache: vi.fn() }
        },
        {
          provide: AuthSessionService,
          useValue: { logout: logoutSpy, hasSession: hasSessionSpy }
        },
        {
          provide: RuntimeConfigService,
          useValue: {
            state: () => ({
              kind: 'ready',
              config: {
                mode: 'remote',
                configApiBaseUrl: '',
                locale: 'pt-BR',
                projectionPath: null,
                initialDecisionKey: null
              }
            })
          }
        }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('caches environment signature cleanly and avoids duplicate HTTP loads via ensureLoaded', () => {
    const bootstrap = TestBed.inject(StudioCatalogBootstrapService);
    const store = TestBed.inject(CatalogSelectionStore);
    const items = [decision('r1'), decision('r2')];
    loadCatalogSpy.mockReturnValue(of(items));

    bootstrap.ensureLoaded();
    expect(loadCatalogSpy).toHaveBeenCalledTimes(1);
    expect(store.allDecisions()).toHaveLength(2);
    expect(bootstrap.hasLoadedCurrentEnvironment()).toBe(true);

    bootstrap.ensureLoaded();
    expect(loadCatalogSpy).toHaveBeenCalledTimes(1);
  });

  it('delegates live selection through catalogBridge when catalog is mounted and navigates when unmounted', () => {
    const bootstrap = TestBed.inject(StudioCatalogBootstrapService);
    const shell = TestBed.inject(StudioShellStateService);
    const store = TestBed.inject(CatalogSelectionStore);
    const selectBridge = vi.fn();
    const navigateSpy = vi.fn();
    shell.registerNavigator(navigateSpy);
    shell.registerCatalogBridge({
      selectDecision: selectBridge,
      applyScope: vi.fn(),
      openMode: vi.fn(),
      hasUnsavedWork: () => false
    });

    const target = decision('r2');
    bootstrap.requestOpenInCatalog(target, 'operate');
    expect(selectBridge).toHaveBeenCalledWith(target, 'operate');
    expect(navigateSpy).not.toHaveBeenCalled();

    shell.registerCatalogBridge(null);
    store.contextScopeFilter.set('other.scope');
    bootstrap.requestOpenInCatalog(target, 'rule');
    expect(store.pendingSelectionKey()).toBe('r2');
    expect(store.pendingWorkMode()).toBe('rule');
    expect(store.deepLinkConsumed()).toBe(true);
    expect(store.contextScopeFilter()).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith('/catalog');
  });

  it('performs full governed state, bridge, capability, and filter wipe on logout', () => {
    const bootstrap = TestBed.inject(StudioCatalogBootstrapService);
    const shell = TestBed.inject(StudioShellStateService);
    const store = TestBed.inject(CatalogSelectionStore);
    const capabilities = TestBed.inject(StudioCapabilitiesService);

    capabilities.applyServerCapabilities(['RULES_MONITORING_VIEW']);
    store.sessionActive.set(true);
    store.allDecisions.set([decision('r1')]);
    store.selected.set(decision('r1'));
    store.query.set('cpf');
    store.contextScopeFilter.set('workforce.attendance');
    store.activeRuleTypeFilter.set('validation');
    store.deepLinkConsumed.set(true);
    store.postLoginReturnRoute.set('/reviews');
    store.timeline.set([{ eventType: 'CREATED', occurredAt: '', summary: 'x', status: null, actor: null }]);
    shell.openAccessBridge({
      resourceKey: 'workforce.attendance',
      serviceKey: null,
      domainLabel: 'Workforce',
      ruleTitle: 'Rule 1',
      decisionKey: 'r1',
      sensitiveFactsCount: 1
    });

    bootstrap.logout();

    expect(logoutSpy).toHaveBeenCalledOnce();
    expect(store.sessionActive()).toBe(false);
    expect(store.allDecisions()).toEqual([]);
    expect(store.selected()).toBeNull();
    expect(store.query()).toBe('');
    expect(store.contextScopeFilter()).toBeNull();
    expect(store.activeRuleTypeFilter()).toBeNull();
    expect(store.deepLinkConsumed()).toBe(false);
    expect(store.postLoginReturnRoute()).toBeNull();
    expect(store.timeline()).toEqual([]);
    expect(shell.accessBridgeContext()).toBeNull();
    expect(capabilities.serverCapabilities()).toBeNull();
    expect(store.authenticationRequired()).toBe(true);
  });

  it('aborts catalog load before requesting definitions when session probe returns false', () => {
    hasSessionSpy.mockReturnValue(of(false));
    const bootstrap = TestBed.inject(StudioCatalogBootstrapService);
    const store = TestBed.inject(CatalogSelectionStore);

    bootstrap.loadCatalog();

    expect(hasSessionSpy).toHaveBeenCalledOnce();
    expect(loadCatalogSpy).not.toHaveBeenCalled();
    expect(store.authenticationRequired()).toBe(true);
    expect(store.loading()).toBe(false);
    expect(store.loadError()).toBe('AUTHENTICATION_REQUIRED');
    expect(store.allDecisions()).toEqual([]);
  });

  it('clears streaming state and refuses to mark partial catalog loaded when interrupted mid-stream', () => {
    const bootstrap = TestBed.inject(StudioCatalogBootstrapService);
    const store = TestBed.inject(CatalogSelectionStore);
    const stream$ = new Subject<{ readonly decisions: readonly DecisionSummary[]; readonly complete: boolean; readonly totalKnown: number | null }>();
    const projection = TestBed.inject(ProjectionCatalogService) as unknown as {
      loadProgressive?: (locale: unknown, config: unknown) => typeof stream$;
    };
    projection.loadProgressive = vi.fn(() => stream$);

    bootstrap.loadCatalog();
    stream$.next({ decisions: [decision('r1')], complete: false, totalKnown: null });

    expect(store.catalogStreaming()).toBe(true);
    expect(bootstrap.hasLoadedCurrentEnvironment()).toBe(false);

    // Interrupt active stream via cancellation (e.g. scope reload or unmount destroy)
    (bootstrap as unknown as { cancelCatalogLoad: () => void }).cancelCatalogLoad();
    expect(store.catalogStreaming()).toBe(false);
    expect(store.catalogTotalHint()).toBeNull();
    expect(bootstrap.hasLoadedCurrentEnvironment()).toBe(false);

    // Fresh complete stream marks environment loaded cleanly
    bootstrap.loadCatalog();
    stream$.next({ decisions: [decision('r1'), decision('r2')], complete: true, totalKnown: 2 });
    expect(store.catalogStreaming()).toBe(false);
    expect(bootstrap.hasLoadedCurrentEnvironment()).toBe(true);
  });

  it('prevents ensureLoaded restart while streaming in background and preserves loaded items on later chunk error', () => {
    const bootstrap = TestBed.inject(StudioCatalogBootstrapService);
    const store = TestBed.inject(CatalogSelectionStore);
    const stream$ = new Subject<import('./projection-catalog.service').ProgressiveCatalogChunk>();
    const summary$ = new Subject<import('./projection-catalog.service').DomainRuleCatalogSummary>();
    const projection = TestBed.inject(ProjectionCatalogService) as unknown as {
      loadProgressive?: (locale: unknown, config: unknown) => typeof stream$;
      loadCatalogSummary?: (config: unknown) => typeof summary$;
    };
    const loadProgSpy = vi.fn(() => stream$);
    const loadSumSpy = vi.fn(() => summary$);
    projection.loadProgressive = loadProgSpy;
    projection.loadCatalogSummary = loadSumSpy;

    const r1 = decision('r1');
    bootstrap.loadCatalog({ onChunk: () => { /* listener active on mount */ } });
    stream$.next({
      decisions: [r1],
      complete: false,
      totalKnown: 42,
      supportsServerSummary: true
    });

    expect(bootstrap.isStreamingCurrentEnvironment()).toBe(true);
    expect(loadSumSpy).toHaveBeenCalledOnce();
    expect(store.catalogTotalHint()).toBe(42);

    // Navigating across shell routes while streaming must not restart catalog load
    bootstrap.detachChunkListener();
    bootstrap.ensureLoaded();
    expect(loadProgSpy).toHaveBeenCalledTimes(1);

    // Partial failure on subsequent batch retains already loaded decisions
    stream$.error(new Error('BATCH_TIMEOUT'));
    expect(store.catalogStreaming()).toBe(false);
    expect(store.allDecisions()).toHaveLength(1);
    expect(store.catalogPartialError()).toBe('CATALOG_PARTIAL_LOAD');
    expect(bootstrap.isStreamingCurrentEnvironment()).toBe(false);
  });
});
