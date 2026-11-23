import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { AuthSessionService } from './auth-session.service';
import { GovernedHostScopeService } from './governed-host-scope.service';
import { PolicyStudioI18n } from './i18n';
import { ProjectionCatalogService } from './projection-catalog.service';
import type { PolicyStudioRuntimeConfig } from './runtime-config';
import { RuntimeConfigService } from './runtime-config.service';
import { StudioCapabilitiesService } from './studio-capabilities.service';
import { StudioShellStateService } from './studio-shell-state.service';
import { StudioTitleStrategy } from './studio-title.strategy';
import { CatalogSelectionStore, type DecisionWorkMode } from '../features/catalog/catalog-selection.store';
import type { DecisionSummary } from '../features/catalog/catalog.fixture';

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
    if (!sig || this.store.loadedEnvironmentSignature() !== sig) {
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
    if (this.hasLoadedCurrentEnvironment()) {
      this.syncDerivedShellBadges();
      return;
    }
    this.loadCatalog();
  }

  loadCatalog(onDecisionReady?: (decision: DecisionSummary) => void): void {
    const loadRevision = ++this.store.catalogLoadRevision;
    const state = this.runtime.state();
    if (state.kind !== 'ready') return;
    const envSignature = this.currentEnvironmentSignature();
    this.store.loading.set(true);
    this.i18n.locale.set(state.config.locale);
    this.titleStrategy?.refreshCurrentTitle();
    this.store.loadError.set(null);
    this.store.authenticationRequired.set(false);
    this.store.permissionLimited.set(false);
    this.catalog.load(this.i18n.locale(), state.config).subscribe({
      next: decisions => {
        if (loadRevision !== this.store.catalogLoadRevision) return;
        this.store.loadedEnvironmentSignature.set(envSignature);
        this.store.authenticationFailed.set(false);
        this.store.sessionActive.set(state.config.mode === 'remote');
        this.store.signingOut.set(false);
        this.shell.syncSessionState(state.config.mode === 'remote', false);
        this.store.logoutFailed.set(false);
        this.store.activeRuleTypeFilter.set(null);
        this.store.allDecisions.set(decisions);
        this.syncDerivedShellBadges();
        const currentSelected = this.store.selected();
        const preserved = currentSelected ? decisions.find(item => item.key === currentSelected.key) : null;
        const initial = preserved
          ?? decisions.find(item => item.key === state.config.initialDecisionKey)
          ?? decisions[0]
          ?? null;
        if (initial) {
          this.store.selected.set(initial);
          onDecisionReady?.(initial);
        } else {
          this.store.selected.set(null);
        }
        this.store.loading.set(false);
      },
      error: (error: unknown) => {
        if (loadRevision !== this.store.catalogLoadRevision) return;
        this.store.loadedEnvironmentSignature.set(null);
        this.store.loading.set(false);
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
