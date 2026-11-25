import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { EMPTY, type Observable, type Subscription, map, of, switchMap } from 'rxjs';
import { AuthSessionService } from './auth-session.service';
import { GovernedHostScopeService } from './governed-host-scope.service';
import { PolicyStudioI18n } from './i18n';
import { ProjectionCatalogService, type ProgressiveCatalogChunk } from './projection-catalog.service';
import type { PolicyStudioRuntimeConfig } from './runtime-config';
import { RuntimeConfigService } from './runtime-config.service';
import { StudioCapabilitiesService } from './studio-capabilities.service';
import { StudioShellStateService } from './studio-shell-state.service';
import { StudioTitleStrategy } from './studio-title.strategy';
import { CatalogSelectionStore, type DecisionWorkMode } from '../features/catalog/catalog-selection.store';
import type { DecisionSummary } from '../features/catalog/catalog.fixture';

export interface CatalogLoadOptions {
  readonly onChunk?: (
    chunk: ProgressiveCatalogChunk,
    decisions: readonly DecisionSummary[],
    replaceExisting: boolean
  ) => void;
  readonly onDecisionReady?: (decision: DecisionSummary) => void;
  readonly onAuthRequired?: () => void;
  readonly onError?: (error: unknown) => void;
}

@Injectable()
export class StudioCatalogBootstrapService {
  private readonly store = inject(CatalogSelectionStore);
  private readonly catalog = inject(ProjectionCatalogService);
  private readonly auth = inject(AuthSessionService);
  private readonly hostScope = inject(GovernedHostScopeService);
  private readonly runtime = inject(RuntimeConfigService);
  private readonly i18n = inject(PolicyStudioI18n);
  private readonly shell = inject(StudioShellStateService);
  private readonly capabilities = inject(StudioCapabilitiesService);
  private readonly titleStrategy = inject(StudioTitleStrategy, { optional: true });
  private readonly destroyRef = inject(DestroyRef, { optional: true });
  private catalogLoadSubscription: Subscription | null = null;
  private catalogSummarySubscription: Subscription | null = null;
  private streamingEnvironmentSignature: string | null = null;
  private activeChunkListener: CatalogLoadOptions['onChunk'] | null = null;

  constructor() {
    this.destroyRef?.onDestroy(() => this.cancelCatalogLoad());
  }

  private cancelCatalogLoad(): void {
    const wasActive = this.catalogLoadSubscription !== null;
    this.catalogLoadSubscription?.unsubscribe();
    this.catalogLoadSubscription = null;
    this.catalogSummarySubscription?.unsubscribe();
    this.catalogSummarySubscription = null;
    this.streamingEnvironmentSignature = null;
    this.activeChunkListener = null;
    if (wasActive && this.store.catalogStreaming()) {
      this.store.catalogStreaming.set(false);
      this.store.catalogTotalHint.set(null);
      this.store.catalogTruncated.set(false);
      this.store.loadedEnvironmentSignature.set(null);
    }
  }

  detachChunkListener(): void {
    this.activeChunkListener = null;
  }

  attachChunkListener(listener: CatalogLoadOptions['onChunk'] | null): void {
    this.activeChunkListener = listener ?? null;
  }

  cancelActiveLoad(): void {
    this.cancelCatalogLoad();
  }

  isStreamingCurrentEnvironment(): boolean {
    const sig = this.currentEnvironmentSignature();
    return Boolean(sig && this.store.catalogStreaming() && this.streamingEnvironmentSignature === sig);
  }

  syncScopeFromLocation(): boolean {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    const hasScopeParam =
      params.has('tenantId') || params.has('organizationId') || params.has('environment');
    if (!hasScopeParam) return false;
    const nextTenantId = params.get('tenantId')?.trim() || null;
    const nextOrganizationId = params.get('organizationId')?.trim() || null;
    const nextEnvironment = params.get('environment')?.trim() || null;
    const current = this.hostScope.scope();
    if (
      nextTenantId === current.tenantId
      && nextOrganizationId === current.organizationId
      && nextEnvironment === current.environment
    ) {
      return false;
    }
    this.hostScope.setScope({
      tenantId: nextTenantId,
      organizationId: nextOrganizationId,
      environment: nextEnvironment
    });
    return true;
  }

  currentEnvironmentSignature(): string | null {
    const state = this.runtime.state();
    if (state.kind !== 'ready') return null;
    const scope = this.hostScope.scope();
    return [
      state.config.mode,
      state.config.configApiBaseUrl ?? '',
      scope.tenantId ?? '',
      scope.organizationId ?? '',
      scope.environment ?? ''
    ].join('|');
  }

  hasLoadedCurrentEnvironment(): boolean {
    const sig = this.currentEnvironmentSignature();
    if (!sig || this.store.loadedEnvironmentSignature() !== sig || this.store.catalogStreaming()) {
      return false;
    }
    return (
      this.store.allDecisions().length > 0
      || this.store.authenticationRequired()
      || this.store.permissionLimited()
    );
  }

  syncDerivedShellBadges(): void {
    this.shell.setReviewQueueCount(this.store.reviewQueueDecisions().length);
  }

  ensureLoaded(): void {
    const state = this.runtime.state();
    if (state.kind !== 'ready') return;
    this.syncScopeFromLocation();
    if (this.hasLoadedCurrentEnvironment() || this.isStreamingCurrentEnvironment()) {
      this.syncDerivedShellBadges();
      return;
    }
    this.loadCatalog();
  }

  loadCatalog(callbackOrOptions?: ((decision: DecisionSummary) => void) | CatalogLoadOptions): void {
    const options: CatalogLoadOptions = typeof callbackOrOptions === 'function'
      ? { onDecisionReady: callbackOrOptions }
      : (callbackOrOptions ?? {});
    this.cancelCatalogLoad();
    const loadRevision = ++this.store.catalogLoadRevision;
    const state = this.runtime.state();
    if (state.kind !== 'ready') return;
    const envSignature = this.currentEnvironmentSignature();
    this.streamingEnvironmentSignature = envSignature;
    this.activeChunkListener = options.onChunk ?? null;
    this.store.loading.set(true);
    this.store.catalogStreaming.set(false);
    this.store.catalogTotalHint.set(null);
    this.store.catalogTruncated.set(false);
    this.store.catalogPartialError.set(null);
    this.store.catalogSummary.set(null);
    this.i18n.locale.set(state.config.locale);
    this.titleStrategy?.refreshCurrentTitle();
    this.store.loadError.set(null);
    this.store.authenticationRequired.set(false);
    this.store.permissionLimited.set(false);
    const sessionCheck$ = state.config.mode === 'remote'
      && !this.store.sessionActive()
      && typeof this.auth.hasSession === 'function'
      ? this.auth.hasSession(state.config)
      : of(true);
    let receivedFirstChunk = false;
    let initialDispatched = false;
    let summaryRequested = false;
    this.catalogLoadSubscription = sessionCheck$.pipe(
      switchMap(active => {
        if (loadRevision !== this.store.catalogLoadRevision) return EMPTY;
        if (!active) {
          this.streamingEnvironmentSignature = null;
          this.activeChunkListener = null;
          this.store.loadedEnvironmentSignature.set(envSignature);
          this.store.catalogStreaming.set(false);
          this.store.catalogTotalHint.set(null);
          this.store.catalogTruncated.set(false);
          this.store.loading.set(false);
          this.store.allDecisions.set([]);
          this.store.selected.set(null);
          this.store.sessionActive.set(false);
          this.shell.syncSessionState(false, false);
          this.store.authenticationRequired.set(true);
          this.store.loadError.set('AUTHENTICATION_REQUIRED');
          this.syncDerivedShellBadges();
          options.onAuthRequired?.();
          return EMPTY;
        }
        const catalogStream$: Observable<ProgressiveCatalogChunk> = typeof this.catalog.loadProgressive === 'function'
          ? this.catalog.loadProgressive(this.i18n.locale(), state.config)
          : this.catalog.load(this.i18n.locale(), state.config).pipe(
              map(decisions => ({ decisions, complete: true, totalKnown: decisions.length }))
            );
        return catalogStream$;
      })
    ).subscribe({
      next: chunk => {
        if (loadRevision !== this.store.catalogLoadRevision) return;
        const replaceExisting = !receivedFirstChunk;
        receivedFirstChunk = true;
        if (
          chunk.supportsServerSummary
          && !summaryRequested
          && state.config.mode === 'remote'
          && typeof this.catalog.loadCatalogSummary === 'function'
        ) {
          summaryRequested = true;
          this.catalogSummarySubscription?.unsubscribe();
          this.catalogSummarySubscription = this.catalog.loadCatalogSummary(state.config).subscribe({
            next: summary => {
              if (loadRevision !== this.store.catalogLoadRevision || !summary) return;
              this.store.catalogSummary.set(summary);
            },
            error: () => {
              // Summary is a progressive acceleration aid; keep catalog stream intact on failure.
            }
          });
        }
        this.store.loadedEnvironmentSignature.set(chunk.complete ? envSignature : null);
        if (chunk.complete) {
          this.streamingEnvironmentSignature = null;
        }
        this.store.authenticationFailed.set(false);
        this.store.sessionActive.set(state.config.mode === 'remote');
        this.store.signingOut.set(false);
        this.shell.syncSessionState(state.config.mode === 'remote', false);
        this.store.logoutFailed.set(false);
        if (replaceExisting) {
          this.store.activeRuleTypeFilter.set(null);
        }
        const decisions = this.store.mergeProgressiveDecisions(chunk.decisions, replaceExisting);
        this.store.catalogStreaming.set(!chunk.complete);
        this.store.catalogTotalHint.set(chunk.totalKnown);
        this.store.catalogTruncated.set(Boolean(chunk.truncated));
        this.store.catalogPartialError.set(chunk.partialError ?? null);
        this.store.catalogChunkRevision.update(v => v + 1);
        this.syncDerivedShellBadges();
        if (this.activeChunkListener) {
          this.activeChunkListener(chunk, decisions, replaceExisting);
        } else {
          const currentSelected = this.store.selected();
          const preserved = currentSelected ? decisions.find(item => item.key === currentSelected.key) : null;
          const initial = preserved
            ?? decisions.find(item => item.key === state.config.initialDecisionKey)
            ?? decisions[0]
            ?? null;
          if (initial) {
            this.store.selected.set(initial);
            if (!initialDispatched) {
              initialDispatched = true;
              options.onDecisionReady?.(initial);
            }
          } else {
            this.store.selected.set(null);
          }
        }
        this.store.loading.set(false);
      },
      error: (error: unknown) => {
        if (loadRevision !== this.store.catalogLoadRevision) return;
        this.streamingEnvironmentSignature = null;
        this.activeChunkListener = null;
        this.store.catalogStreaming.set(false);
        this.store.loading.set(false);
        const isAuthError = error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);
        if (receivedFirstChunk && !isAuthError && this.store.allDecisions().length > 0) {
          this.store.loadedEnvironmentSignature.set(null);
          this.store.catalogPartialError.set('CATALOG_PARTIAL_LOAD');
          this.syncDerivedShellBadges();
          options.onError?.(error);
          return;
        }
        this.store.catalogTotalHint.set(null);
        this.store.catalogTruncated.set(false);
        this.store.catalogPartialError.set(null);
        this.store.loadedEnvironmentSignature.set(null);
        this.store.allDecisions.set([]);
        this.store.selected.set(null);
        this.syncDerivedShellBadges();
        this.store.loadError.set(error instanceof Error ? error.message : 'PROJECTION_LOAD_FAILED');
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.store.sessionActive.set(false);
          this.shell.syncSessionState(false, false);
          this.store.authenticationRequired.set(true);
        } else if (error instanceof HttpErrorResponse && error.status === 403) {
          this.resolveForbiddenResponse(state.config, loadRevision);
        }
        options.onError?.(error);
      }
    });
  }

  requestOpenInCatalog(decision: DecisionSummary, mode: DecisionWorkMode = 'understand'): void {
    const bridge = this.shell.catalogBridge();
    if (bridge) {
      bridge.selectDecision(decision, mode);
      return;
    }
    this.store.deepLinkConsumed.set(true);
    if (!this.store.decisions().some(item => item.key === decision.key)) {
      this.store.contextScopeFilter.set(null);
      this.store.activeRuleTypeFilter.set(null);
    }
    this.store.pendingSelectionKey.set(decision.key);
    this.store.pendingWorkMode.set(mode);
    this.store.selected.set(decision);
    this.store.narrowDetailOpen.set(true);
    this.shell.navigateToRoute('/catalog');
  }

  logout(): void {
    const state = this.runtime.state();
    if (state.kind !== 'ready' || !this.store.sessionActive() || this.store.signingOut()) return;
    this.store.signingOut.set(true);
    this.shell.syncSessionState(true, true);
    this.store.logoutFailed.set(false);
    this.auth.logout(state.config).subscribe({
      next: () => {
        this.cancelCatalogLoad();
        ++this.store.catalogLoadRevision;
        this.store.loadedEnvironmentSignature.set(null);
        this.store.signingOut.set(false);
        this.store.sessionActive.set(false);
        this.shell.syncSessionState(false, false);
        this.catalog.invalidateCatalogMetaCache?.();
        this.store.invalidateSharedLoadsAndReset();
        this.store.query.set('');
        this.store.contextScopeFilter.set(null);
        this.store.activeRuleTypeFilter.set(null);
        this.store.pendingSelectionKey.set(null);
        this.store.pendingWorkMode.set(null);
        this.store.deepLinkConsumed.set(false);
        this.store.postLoginReturnRoute.set(null);
        this.store.allDecisions.set([]);
        this.store.selected.set(null);
        this.store.narrowDetailOpen.set(false);
        this.shell.clearAccessBridgeContext();
        this.shell.setBreadcrumbs([]);
        this.capabilities.reset();
        this.syncDerivedShellBadges();
        this.store.loading.set(false);
        this.store.permissionLimited.set(false);
        this.store.authenticationFailed.set(false);
        this.store.authenticationRequired.set(true);
        this.store.loadError.set('AUTHENTICATION_REQUIRED');
      },
      error: () => {
        this.store.signingOut.set(false);
        this.shell.syncSessionState(this.store.sessionActive(), false);
        this.store.logoutFailed.set(true);
      }
    });
  }

  private resolveForbiddenResponse(config: PolicyStudioRuntimeConfig, catalogRevision: number): void {
    this.auth.hasSession(config).subscribe({
      next: active => {
        if (catalogRevision !== this.store.catalogLoadRevision) return;
        this.store.sessionActive.set(active);
        this.shell.syncSessionState(active, this.store.signingOut());
        active ? this.store.permissionLimited.set(true) : this.store.authenticationRequired.set(true);
      },
      error: () => {
        if (catalogRevision !== this.store.catalogLoadRevision) return;
        this.store.loadError.set('SESSION_STATUS_UNAVAILABLE');
      }
    });
  }
}
