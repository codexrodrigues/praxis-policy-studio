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
import { ReviewsPageComponent } from './reviews-page.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

function makeDecision(
  key: string,
  workspaceStatus?: string,
  overrides: Partial<DecisionSummary> = {}
): DecisionSummary {
  return {
    order: 1,
    totalDecisions: 4,
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
    draftLifecycle: null,
    workspaceId: workspaceStatus ? `ws-${key}` : undefined,
    workspaceStatus,
    workspaceRevision: workspaceStatus ? 3 : undefined,
    ...overrides
  };
}

describe('ReviewsPageComponent', () => {
  let fixture: ComponentFixture<ReviewsPageComponent>;
  let store: CatalogSelectionStore;
  const ensureLoadedSpy = vi.fn();
  const requestOpenInCatalogSpy = vi.fn();
  const browseAccessCatalogSpy = vi.fn();

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  beforeEach(async () => {
    ensureLoadedSpy.mockReset();
    requestOpenInCatalogSpy.mockReset();
    browseAccessCatalogSpy.mockReset();
    browseAccessCatalogSpy.mockReturnValue(of({
      candidates: [],
      page: 0,
      limit: 12,
      hasMore: false,
      totalElements: 0,
      truncated: false
    }));

    await TestBed.configureTestingModule({
      imports: [ReviewsPageComponent],
      providers: [
        provideRouter([]),
        PolicyStudioI18n,
        CatalogSelectionStore,
        {
          provide: ProjectionCatalogService,
          useValue: { load: () => of([]), browseAccessCatalog: browseAccessCatalogSpy }
        },
        { provide: AuthSessionService, useValue: { hasSession: () => of(true) } },
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
            }),
            mode: () => 'remote'
          }
        },
        {
          provide: StudioCatalogBootstrapService,
          useValue: {
            ensureLoaded: ensureLoadedSpy,
            loadCatalog: vi.fn(),
            requestOpenInCatalog: requestOpenInCatalogSpy
          }
        }
      ]
    }).compileComponents();

    store = TestBed.inject(CatalogSelectionStore);
    store.loading.set(false);
    store.allDecisions.set([
      makeDecision('stable.rule', 'PROMOTED'),
      makeDecision('review.rule', 'SUBMITTED'),
      makeDecision('open.rule', 'OPEN'),
      makeDecision('approved.rule', 'APPROVED')
    ]);

    fixture = TestBed.createComponent(ReviewsPageComponent);
    fixture.detectChanges();
  });

  it('shows only pending governance items prioritized by status and filters cleanly by bucket', () => {
    expect(ensureLoadedSpy).toHaveBeenCalledOnce();
    const shell = TestBed.inject(StudioShellStateService);
    expect(shell.activeNavItem()).toBe('reviews');

    const rows = fixture.debugElement.queryAll(By.css('[data-testid^="reviews-item-"]'));
    expect(rows.map(el => el.nativeElement.getAttribute('data-testid'))).toEqual([
      'reviews-item-review.rule',
      'reviews-item-approved.rule',
      'reviews-item-open.rule'
    ]);

    const submittedTab = fixture.debugElement.query(By.css('[data-testid="reviews-tab-submitted"]')).nativeElement as HTMLButtonElement;
    submittedTab.click();
    fixture.detectChanges();

    const filteredRows = fixture.debugElement.queryAll(By.css('[data-testid^="reviews-item-"]'));
    expect(filteredRows).toHaveLength(1);
    expect(filteredRows[0]!.nativeElement.getAttribute('data-testid')).toBe('reviews-item-review.rule');
  });

  it('opens submitted rules directly in operate mode and open drafts in rule mode', () => {
    const submittedBtn = fixture.debugElement.query(By.css('[data-testid="reviews-open-review.rule"]')).nativeElement as HTMLButtonElement;
    submittedBtn.click();
    expect(requestOpenInCatalogSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ key: 'review.rule' }),
      'operate'
    );

    const openBtn = fixture.debugElement.query(By.css('[data-testid="reviews-open-open.rule"]')).nativeElement as HTMLButtonElement;
    openBtn.click();
    expect(requestOpenInCatalogSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ key: 'open.rule' }),
      'rule'
    );
  });

  it('searches definitionDocumentation titles, triggers refresh, and renders permissionLimited state', () => {
    store.allDecisions.set([
      makeDecision('doc.rule', 'OPEN', {
        definitionDocumentation: { title: 'Prazo retroativo institucional' }
      })
    ]);
    fixture.detectChanges();

    const searchInput = fixture.debugElement.query(By.css('[data-testid="reviews-search-input"]')).nativeElement as HTMLInputElement;
    searchInput.value = 'retroativo';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.debugElement.queryAll(By.css('[data-testid^="reviews-item-"]'))).toHaveLength(1);

    const refreshBtn = fixture.debugElement.query(By.css('[data-testid="reviews-refresh-btn"]')).nativeElement as HTMLButtonElement;
    refreshBtn.click();
    expect(TestBed.inject(StudioCatalogBootstrapService).loadCatalog).toHaveBeenCalledOnce();

    store.allDecisions.set([]);
    store.permissionLimited.set(true);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('[data-testid="reviews-permission-card"]'))).not.toBeNull();
  });

  it('centers empty queue state without duplicating the catalog link in the header', () => {
    store.allDecisions.set([makeDecision('stable.rule', 'PROMOTED')]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="reviews-empty-state"]')).toBeTruthy();
    expect(el.querySelectorAll('.reviews-head-actions a')).toHaveLength(0);
    expect(el.querySelectorAll('[data-testid="reviews-empty-state"] a')).toHaveLength(1);
  });

  it('loads segregated pending authorization policies on demand and excludes active policies', () => {
    store.catalogSummary.set({
      schemaVersion: 'praxis-domain-rule-catalog-summary.v1',
      totalDefinitions: 5,
      totalBusinessRules: 2,
      totalAuthorizationPolicies: 3,
      byContextKey: [],
      byResourceKey: [],
      byRuleType: [],
      byDefinitionStatus: [],
      reviewQueue: { openDrafts: 0, inReview: 0, approved: 0, rejected: 0, promoted: 0, totalPending: 0 }
    });
    browseAccessCatalogSpy.mockReturnValue(of({
      candidates: [
        {
          definitionId: 'auth-draft',
          ruleKey: 'access.docs.draft',
          version: 1,
          ruleType: 'authorization_policy',
          status: 'draft',
          contextKey: 'workforce.docs',
          resourceKey: 'workforce.docs',
          serviceKey: 'docs-service',
          semanticOwner: null,
          updatedAt: '2026-11-25T00:00:00Z',
          displayName: 'Política em rascunho'
        },
        {
          definitionId: 'auth-approved',
          ruleKey: 'access.docs.approved',
          version: 1,
          ruleType: 'authorization_policy',
          status: 'approved',
          contextKey: 'workforce.docs',
          resourceKey: 'workforce.docs',
          serviceKey: 'docs-service',
          semanticOwner: null,
          updatedAt: '2026-11-25T00:00:00Z',
          displayName: 'Política aprovada'
        },
        {
          definitionId: 'auth-active',
          ruleKey: 'access.docs.active',
          version: 1,
          ruleType: 'authorization_policy',
          status: 'active',
          contextKey: 'workforce.docs',
          resourceKey: 'workforce.docs',
          serviceKey: 'docs-service',
          semanticOwner: null,
          updatedAt: '2026-11-25T00:00:00Z',
          displayName: 'Política ativa'
        }
      ],
      page: 0,
      limit: 50,
      hasMore: false,
      totalElements: 3,
      truncated: false
    }));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(browseAccessCatalogSpy).not.toHaveBeenCalled();

    const loadBtn = el.querySelector('[data-testid="reviews-load-authz-btn"]') as HTMLButtonElement;
    expect(loadBtn).toBeTruthy();
    loadBtn.click();
    fixture.detectChanges();

    expect(browseAccessCatalogSpy).toHaveBeenCalledOnce();
    expect(browseAccessCatalogSpy).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'remote' }),
      { page: 0, limit: 50 }
    );
    const listText = el.querySelector('[data-testid="reviews-authz-list"]')?.textContent ?? '';
    expect(listText).toContain('Política em rascunho');
    expect(listText).toContain('Política aprovada');
    expect(listText).not.toContain('Política ativa');
  });
});
