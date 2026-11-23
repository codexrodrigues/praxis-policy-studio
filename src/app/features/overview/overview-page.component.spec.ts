import '@angular/compiler';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSessionService } from '../../core/auth-session.service';
import { PolicyStudioI18n } from '../../core/i18n';
import { ProjectionCatalogService } from '../../core/projection-catalog.service';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import { StudioCatalogBootstrapService } from '../../core/studio-catalog-bootstrap.service';
import { StudioShellStateService } from '../../core/studio-shell-state.service';
import { CatalogSelectionStore } from '../catalog/catalog-selection.store';
import type { DecisionSummary } from '../catalog/catalog.fixture';
import { OverviewPageComponent } from './overview-page.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

function decision(key: string): DecisionSummary {
  return {
    order: 1,
    totalDecisions: 2,
    key,
    code: key.toUpperCase(),
    name: `Regra ${key}`,
    domain: 'workforce.attendance',
    ruleSet: 'workforce.attendance.launch',
    ruleSetKey: 'workforce.attendance.launch',
    resourceKey: 'workforce.attendance',
    serviceKey: 'attendance-service',
    state: 'verified',
    meaning: `Significado de ${key}`,
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

describe('OverviewPageComponent', () => {
  let fixture: ComponentFixture<OverviewPageComponent>;
  let store: CatalogSelectionStore;
  const ensureLoadedSpy = vi.fn();
  const loadCatalogSpy = vi.fn();
  const requestOpenInCatalogSpy = vi.fn();

  beforeEach(async () => {
    ensureLoadedSpy.mockReset();
    loadCatalogSpy.mockReset();
    requestOpenInCatalogSpy.mockReset();

    await TestBed.configureTestingModule({
      imports: [OverviewPageComponent],
      providers: [
        provideRouter([{ path: 'catalog', children: [] }]),
        PolicyStudioI18n,
        CatalogSelectionStore,
        { provide: ProjectionCatalogService, useValue: { load: () => of([]) } },
        { provide: AuthSessionService, useValue: { hasSession: () => of(true) } },
        {
          provide: RuntimeConfigService,
          useValue: {
            state: () => ({ kind: 'ready', config: { mode: 'remote', configApiBaseUrl: '', locale: 'pt-BR', projectionPath: null, initialDecisionKey: null } }),
            mode: () => 'remote'
          }
        },
        {
          provide: StudioCatalogBootstrapService,
          useValue: {
            ensureLoaded: ensureLoadedSpy,
            loadCatalog: loadCatalogSpy,
            requestOpenInCatalog: requestOpenInCatalogSpy
          }
        }
      ]
    }).compileComponents();

    store = TestBed.inject(CatalogSelectionStore);
    store.loading.set(false);
    fixture = TestBed.createComponent(OverviewPageComponent);
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('renders portfolio overview, triggers refresh, and handles permissionLimited + auth return route', async () => {
    store.allDecisions.set([decision('a'), decision('b')]);
    fixture.detectChanges();

    expect(ensureLoadedSpy).toHaveBeenCalledOnce();
    expect(fixture.debugElement.query(By.css('[data-testid="catalog-portfolio-overview"]'))).not.toBeNull();

    const refreshBtn = fixture.debugElement.query(By.css('[data-testid="overview-refresh-btn"]')).nativeElement as HTMLButtonElement;
    refreshBtn.click();
    expect(loadCatalogSpy).toHaveBeenCalledOnce();

    store.allDecisions.set([]);
    store.permissionLimited.set(true);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('[data-testid="overview-permission-card"]'))).not.toBeNull();

    store.permissionLimited.set(false);
    store.authenticationRequired.set(true);
    fixture.detectChanges();
    const authLink = fixture.debugElement.query(By.css('[data-testid="overview-auth-card"] a')).nativeElement as HTMLAnchorElement;
    authLink.click();
    expect(store.postLoginReturnRoute()).toBe('/overview');
    await fixture.whenStable();
  });

  it('navigates cleanly to catalog when selecting scope without carrying stale portfolio flags', () => {
    const shell = TestBed.inject(StudioShellStateService);
    const navSpy = vi.fn();
    shell.registerNavigator(navSpy);
    const item = decision('a');
    store.allDecisions.set([item]);
    store.selected.set(item);
    fixture.detectChanges();

    fixture.componentInstance.openScopeInCatalog('workforce.attendance.launch');
    expect(store.deepLinkConsumed()).toBe(true);
    expect(store.contextScopeFilter()).toBe('workforce.attendance.launch');
    expect(navSpy).toHaveBeenCalledWith('/catalog');
  });
});
