import '@angular/compiler';
import { JsonPipe } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA, signal, ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { of } from 'rxjs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSessionService } from '../../core/auth-session.service';
import { PolicyStudioI18n } from '../../core/i18n';
import { ProjectionCatalogService } from '../../core/projection-catalog.service';
import type { PolicyStudioRuntimeConfig } from '../../core/runtime-config';
import type { StudioViewDepth } from '../../core/studio-shell-state.service';
import { CatalogSelectionStore } from '../catalog/catalog-selection.store';
import { AccessDraftReviewComponent } from './access-draft-review.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

async function resolveTemplate(url: string): Promise<string> {
  if (url.endsWith('.scss')) {
    return '';
  }
  const fsModule = (
    globalThis as unknown as {
      process?: {
        getBuiltinModule?: (id: string) => {
          existsSync: (file: URL) => boolean;
          readFileSync: (file: URL, encoding: string) => string;
        };
      };
    }
  ).process?.getBuiltinModule?.('node:fs');
  const localUrl = new URL(url, import.meta.url);
  if (fsModule?.existsSync(localUrl)) {
    return fsModule.readFileSync(localUrl, 'utf8');
  }
  const catalogUrl = new URL(url.replace('./', '../catalog/'), import.meta.url);
  return fsModule?.existsSync(catalogUrl) ? fsModule.readFileSync(catalogUrl, 'utf8') : '';
}

describe('AccessDraftReviewComponent', () => {
  let fixture: ComponentFixture<AccessDraftReviewComponent>;
  let store: CatalogSelectionStore;
  const viewDepthSig = signal<StudioViewDepth>('business');
  const browseAccessCatalogSpy = vi.fn();
  let templateHtml = '';

  const remoteConfig: PolicyStudioRuntimeConfig = {
    mode: 'remote',
    configApiBaseUrl: '',
    locale: 'pt-BR',
    projectionPath: null,
    initialDecisionKey: null
  };

  beforeAll(async () => {
    templateHtml = await resolveTemplate('./access-draft-review.component.html');
    await resolveComponentResources(resolveTemplate);
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  beforeEach(async () => {
    browseAccessCatalogSpy.mockReset();
    browseAccessCatalogSpy.mockReturnValue(of({
      candidates: [],
      page: 0,
      limit: 12,
      hasMore: false,
      totalElements: 0,
      truncated: false
    }));
    viewDepthSig.set('business');

    TestBed.configureTestingModule({
      imports: [AccessDraftReviewComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        PolicyStudioI18n,
        CatalogSelectionStore,
        { provide: AuthSessionService, useValue: { hasSession: () => of(true) } },
        {
          provide: ProjectionCatalogService,
          useValue: {
            browseAccessCatalog: browseAccessCatalogSpy,
            listAccessDefinitions: () => of([])
          }
        }
      ]
    });
    TestBed.overrideComponent(AccessDraftReviewComponent, {
      set: {
        template: templateHtml,
        templateUrl: null as unknown as string,
        styleUrl: null as unknown as string,
        styles: [],
        imports: [JsonPipe],
        schemas: [NO_ERRORS_SCHEMA]
      }
    });
    await TestBed.compileComponents();

    store = TestBed.inject(CatalogSelectionStore);
    fixture = TestBed.createComponent(AccessDraftReviewComponent);
    Object.defineProperty(fixture.componentInstance, 'config', {
      value: signal(remoteConfig),
      configurable: true
    });
    Object.defineProperty(fixture.componentInstance, 'viewDepth', {
      value: viewDepthSig,
      configurable: true
    });
    fixture.detectChanges();
  });

  it('orders policy discovery above JSON authoring and adapts textarea height by viewDepth', () => {
    const el = fixture.nativeElement as HTMLElement;
    const loadBtn = el.querySelector('[data-testid="access-load-existing-btn"]') as HTMLButtonElement;
    const jsonSource = el.querySelector('#access-source') as HTMLTextAreaElement;

    expect(loadBtn).toBeTruthy();
    expect(jsonSource).toBeTruthy();
    expect(loadBtn.compareDocumentPosition(jsonSource) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(jsonSource.rows).toBe(3);

    viewDepthSig.set('technical');
    fixture.detectChanges();
    expect(jsonSource.rows).toBe(5);
  });

  it('uses limit=12 when catalogSummary is absent and limit=25 when Bloco B summary is present', () => {
    const el = fixture.nativeElement as HTMLElement;
    const loadBtn = el.querySelector('[data-testid="access-load-existing-btn"]') as HTMLButtonElement;

    store.catalogSummary.set(null);
    loadBtn.click();
    expect(browseAccessCatalogSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'remote' }),
      expect.objectContaining({ page: 0, limit: 12 })
    );

    store.catalogSummary.set({
      schemaVersion: 'praxis-domain-rule-catalog-summary.v1',
      totalDefinitions: 10,
      totalBusinessRules: 8,
      totalAuthorizationPolicies: 2,
      byContextKey: [],
      byResourceKey: [],
      byRuleType: [],
      byDefinitionStatus: [],
      reviewQueue: { openDrafts: 0, inReview: 0, approved: 0, rejected: 0, promoted: 0, totalPending: 0 }
    });
    loadBtn.click();
    expect(browseAccessCatalogSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'remote' }),
      expect.objectContaining({ page: 0, limit: 25 })
    );
  });
});
