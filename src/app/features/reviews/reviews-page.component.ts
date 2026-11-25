import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  classifyDecisionWorkflowBucket,
  type WorkflowBucketId
} from '../../core/catalog-portfolio';
import { humanizeDecisionTitle, humanizeTechnicalSlug, looksLikeTechnicalSlug } from '../../core/humanize-labels';
import { PolicyStudioI18n } from '../../core/i18n';
import {
  type ExtendedCatalogCandidate,
  ProjectionCatalogService
} from '../../core/projection-catalog.service';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import { StudioCatalogBootstrapService } from '../../core/studio-catalog-bootstrap.service';
import { StudioShellStateService } from '../../core/studio-shell-state.service';
import { StudioIconComponent, type StudioIconName } from '../../shared/studio-icon.component';
import { CatalogSelectionStore, type DecisionWorkMode } from '../catalog/catalog-selection.store';
import type { DecisionSummary } from '../catalog/catalog.fixture';

type ReviewBucketFilter = 'ALL' | Exclude<WorkflowBucketId, 'STABLE'>;

@Component({
  selector: 'pax-reviews-page',
  standalone: true,
  imports: [RouterLink, StudioIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="reviews-shell" data-testid="reviews-page" aria-labelledby="reviews-page-title">
      <header class="reviews-head">
        <div>
          <p class="studio-eyebrow">{{ i18n.text('reviewsPageEyebrow') }}</p>
          <h1 id="reviews-page-title">{{ i18n.text('reviewsPageTitle') }}</h1>
          <p class="reviews-subtitle">{{ i18n.text('reviewsPageSubtitle') }}</p>
        </div>
        <div class="reviews-head-actions">
          <button
            type="button"
            class="quiet-button refresh-btn"
            data-testid="reviews-refresh-btn"
            [disabled]="store.loading()"
            [attr.title]="i18n.text('refreshQueueHint')"
            (click)="bootstrap.loadCatalog()">
            <pax-icon name="refresh-cw" [size]="14" />
            <span>{{ i18n.text('refreshQueueCta') }}</span>
          </button>
          @if (queueItems().length > 0) {
            <a class="quiet-button" routerLink="/catalog" queryParamsHandling="preserve">
              <span>{{ i18n.text('reviewsGoToCatalogCta') }}</span>
              <pax-icon name="arrow-right" [size]="14" />
            </a>
          }
        </div>
      </header>

      @if (store.loading() && store.allDecisions().length === 0) {
        <div class="reviews-state-card" aria-live="polite">
          <p>{{ i18n.text('loading') }}</p>
        </div>
      } @else if (store.authenticationRequired()) {
        <div class="reviews-state-card" data-testid="reviews-auth-card">
          <p>{{ i18n.text('reviewsAuthPrompt') }}</p>
          <a
            class="primary-action"
            routerLink="/catalog"
            queryParamsHandling="preserve"
            (click)="rememberReturnRoute()">
            {{ i18n.text('reviewsGoToCatalogCta') }}
          </a>
        </div>
      } @else if (store.permissionLimited()) {
        <div class="reviews-state-card" data-testid="reviews-permission-card" role="status">
          <p>{{ i18n.text('permissionLimited') }}</p>
        </div>
      } @else if (store.loadError() && store.allDecisions().length === 0) {
        <div class="reviews-state-card" role="alert">
          <p>{{ i18n.text('remoteError') }}</p>
          <button type="button" class="quiet-button" (click)="bootstrap.loadCatalog()">
            {{ i18n.text('retryCatalog') }}
          </button>
        </div>
      } @else {
        <div class="reviews-toolbar">
          <div class="bucket-tabs" role="tablist" [attr.aria-label]="i18n.text('reviewsPageTitle')">
            @for (tab of bucketTabs(); track tab.id) {
              <button
                type="button"
                role="tab"
                [attr.data-testid]="'reviews-tab-' + tab.id.toLowerCase()"
                [class.active]="activeBucket() === tab.id"
                [attr.aria-selected]="activeBucket() === tab.id"
                (click)="activeBucket.set(tab.id)">
                <span>{{ tab.label }}</span>
                <span class="tab-count studio-mono">{{ tab.count }}</span>
              </button>
            }
          </div>

          <label class="queue-search">
            <pax-icon name="search" [size]="14" />
            <span class="visually-hidden">{{ i18n.text('reviewsSearchPlaceholder') }}</span>
            <input
              type="search"
              data-testid="reviews-search-input"
              [value]="searchQuery()"
              [placeholder]="i18n.text('reviewsSearchPlaceholder')"
              (input)="searchQuery.set($any($event.target).value)" />
          </label>
        </div>

        @if (filteredItems().length > 0) {
          <ul class="reviews-list" data-testid="reviews-queue-list">
            @for (item of filteredItems(); track item.key) {
              <li class="review-row" [attr.data-testid]="'reviews-item-' + item.key">
                <span class="row-icon" [attr.data-tone]="bucketTone(item)" aria-hidden="true">
                  <pax-icon [name]="autonomyIcon(item)" [size]="16" />
                </span>
                <div class="row-copy">
                  <div class="row-meta">
                    <span class="row-scope">{{ displayScope(item) }}</span>
                    @if (shell.viewDepth() === 'technical') {
                      <code class="row-code studio-mono">{{ item.code }}</code>
                    }
                  </div>
                  <strong>{{ displayTitle(item) }}</strong>
                  @if (item.meaning && item.meaning !== item.name) {
                    <p>{{ item.meaning }}</p>
                  }
                </div>
                <div class="row-status">
                  <span class="studio-badge" [attr.data-tone]="bucketTone(item)">
                    {{ bucketLabel(item) }}
                  </span>
                  @if (item.workspaceRevision) {
                    <small class="studio-mono">{{ i18n.text('reviewsRevisionPrefix') }} {{ item.workspaceRevision }}</small>
                  }
                </div>
                <button
                  type="button"
                  class="quiet-button row-open-btn"
                  [attr.data-testid]="'reviews-open-' + item.key"
                  (click)="openInCatalog(item)">
                  <span>{{ i18n.text('reviewsOpenRuleCta') }}</span>
                  <pax-icon name="arrow-right" [size]="14" />
                </button>
              </li>
            }
          </ul>
        } @else {
          <div class="reviews-state-card" data-testid="reviews-empty-state">
            <h2>{{ i18n.text('reviewsEmptyTitle') }}</h2>
            <p>
              {{ queueItems().length === 0 ? i18n.text('reviewsEmptyBody') : i18n.text('reviewsFilteredEmptyBody') }}
            </p>
            <a class="quiet-button" routerLink="/catalog" queryParamsHandling="preserve">
              {{ i18n.text('reviewsGoToCatalogCta') }}
            </a>
          </div>
        }

        @if (!store.authenticationRequired() && runtime.mode() === 'remote') {
          <section class="reviews-authz-section" data-testid="reviews-authorization-section" aria-labelledby="reviews-authz-title">
            <header class="reviews-authz-head">
              <div>
                <h2 id="reviews-authz-title">
                  {{ i18n.text('reviewsAuthzSectionTitle') }}
                  @if (knownAuthzCount(); as totalCount) {
                    <span class="tab-count studio-mono">{{ totalCount }}</span>
                  }
                </h2>
                <p class="reviews-subtitle">{{ i18n.text('reviewsAuthzSectionSubtitle') }}</p>
              </div>
              <div class="reviews-authz-actions">
                <button
                  type="button"
                  class="quiet-button"
                  data-testid="reviews-load-authz-btn"
                  [disabled]="authzLoading()"
                  (click)="loadAuthzQueue()">
                  {{ i18n.text('accessLoadExistingCta') }}
                </button>
                <a class="quiet-button" routerLink="/access" queryParamsHandling="preserve">
                  <span>{{ i18n.text('reviewsAuthzOpenTrackCta') }}</span>
                  <pax-icon name="arrow-right" [size]="14" />
                </a>
              </div>
            </header>
            @if (authzLoading()) {
              <p class="reviews-subtitle" aria-live="polite">{{ i18n.text('loading') }}</p>
            } @else if (authzError()) {
              <p class="reviews-subtitle" role="alert">{{ i18n.text('accessLoadExistingFailed') }}</p>
            } @else if (authzLoaded()) {
              @if (pendingAuthzPolicies().length > 0) {
                <ul class="reviews-list" data-testid="reviews-authz-list">
                  @for (policy of pendingAuthzPolicies(); track policy.definitionId) {
                    <li class="review-row" [attr.data-testid]="'reviews-authz-item-' + policy.ruleKey">
                      <span class="row-icon" data-tone="info" aria-hidden="true">
                        <pax-icon name="shield-check" [size]="16" />
                      </span>
                      <div class="row-copy">
                        <div class="row-meta">
                          <span class="row-scope">{{ policy.resourceKey || policy.contextKey || 'AUTHORIZATION' }}</span>
                          @if (shell.viewDepth() === 'technical') {
                            <code class="row-code studio-mono">{{ policy.ruleKey }}</code>
                          }
                        </div>
                        <strong>{{ policy.displayName || policy.ruleKey }}</strong>
                      </div>
                      <div class="row-status">
                        <span class="studio-badge" data-tone="info">{{ policy.status }}</span>
                        <small class="studio-mono">v{{ policy.version }}</small>
                      </div>
                      <a class="quiet-button row-open-btn" routerLink="/access" queryParamsHandling="preserve">
                        <span>{{ i18n.text('reviewsAuthzOpenTrackCta') }}</span>
                        <pax-icon name="arrow-right" [size]="14" />
                      </a>
                    </li>
                  }
                </ul>
              } @else {
                <p class="reviews-subtitle" role="status">{{ i18n.text('reviewsAuthzEmpty') }}</p>
              }
            }
          </section>
        }
      }
    </section>
  `,
  styles: [`
    :host {
      display: block;
      min-width: 0;
    }

    .reviews-shell {
      max-width: 82rem;
      margin-inline: auto;
      padding: clamp(1.25rem, 2.5vw, var(--pax-space-8)) clamp(1rem, 3vw, var(--pax-space-10));
      display: grid;
      gap: var(--pax-space-5);
    }

    .reviews-head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--pax-space-4);
    }

    .reviews-head-actions,
    .reviews-authz-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--pax-space-2);
    }

    .refresh-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--pax-space-2);
    }

    .reviews-head h1 {
      margin: var(--pax-space-1) 0 0;
      font-family: var(--pax-font-display);
      font-size: clamp(var(--pax-text-lg), 2vw, var(--pax-text-xl));
      line-height: var(--pax-lh-xl);
      font-weight: 700;
      letter-spacing: -0.02em;
      text-wrap: balance;
    }

    .reviews-subtitle {
      margin: var(--pax-space-1) 0 0;
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-sm);
      line-height: var(--pax-lh-sm);
      max-width: 48rem;
      text-wrap: pretty;
    }

    .reviews-head a,
    .reviews-state-card a {
      text-decoration: none;
    }

    .reviews-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--pax-space-3);
      padding-bottom: var(--pax-space-3);
      border-bottom: 1px solid var(--pax-color-outline-variant);
    }

    .bucket-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: var(--pax-space-1);
    }

    .bucket-tabs button {
      display: inline-flex;
      align-items: center;
      gap: var(--pax-space-2);
      min-height: 2.25rem;
      padding: var(--pax-space-1) var(--pax-space-3);
      border: 1px solid var(--pax-color-outline-variant);
      border-radius: var(--pax-radius-pill);
      background: var(--pax-color-surface);
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-xs);
      font-weight: 600;
      cursor: pointer;
    }

    .bucket-tabs button.active {
      background: var(--pax-color-primary-container);
      color: var(--pax-color-on-primary-container);
      border-color: var(--pax-color-primary);
      font-weight: 700;
    }

    .bucket-tabs button:focus-visible,
    .queue-search:focus-within {
      outline: 2px solid var(--pax-color-primary);
      outline-offset: 2px;
    }

    .tab-count {
      padding: 0.25rem var(--pax-space-2);
      border-radius: var(--pax-radius-pill);
      background: var(--pax-color-surface-container);
      color: var(--pax-color-on-surface-variant);
      font-size: 0.7rem;
      font-weight: 700;
      text-box: trim-both cap alphabetic;
    }

    .queue-search {
      display: flex;
      align-items: center;
      gap: var(--pax-space-2);
      min-width: min(100%, 19rem);
      padding: 0 var(--pax-space-3);
      min-height: 2.25rem;
      border-radius: var(--pax-radius-md);
      border: 1px solid var(--pax-color-outline-variant);
      background: var(--pax-color-surface);
      color: var(--pax-color-on-surface-variant);
    }

    .queue-search input {
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--pax-color-on-surface);
      font: inherit;
      font-size: var(--pax-text-sm);
      width: 100%;
    }

    .reviews-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--pax-space-2);
    }

    .review-row {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto auto;
      align-items: center;
      gap: var(--pax-space-3) var(--pax-space-4);
      padding: var(--pax-space-4);
      border-radius: var(--pax-radius-lg);
      border: 1px solid var(--pax-color-outline-variant);
      background: var(--pax-color-surface);
      min-width: 0;
    }

    .row-icon {
      width: 2.125rem;
      height: 2.125rem;
      border-radius: var(--pax-radius-md);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--pax-color-surface-container);
      color: var(--pax-color-on-surface-variant);
    }

    .row-icon[data-tone='warning'] {
      background: var(--pax-color-warning-container);
      color: var(--pax-color-on-warning-container);
    }

    .row-icon[data-tone='info'] {
      background: var(--pax-color-info-bg);
      color: var(--pax-color-info-fg);
    }

    .row-icon[data-tone='success'] {
      background: var(--pax-color-tertiary-container);
      color: var(--pax-color-on-tertiary-container);
    }

    .row-icon[data-tone='danger'] {
      background: var(--pax-color-error-container);
      color: var(--pax-color-on-error-container);
    }

    .row-copy {
      display: grid;
      gap: 0.2rem;
      min-width: 0;
    }

    .row-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--pax-space-2);
    }

    .row-scope {
      color: var(--pax-color-primary);
      font-size: var(--pax-text-xs);
      font-weight: 700;
    }

    .row-code {
      padding: 0.0625rem var(--pax-space-2);
      border-radius: var(--pax-radius-sm);
      background: var(--pax-color-surface-container);
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-xs);
    }

    .row-copy strong {
      font-size: var(--pax-text-base);
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .row-copy p {
      margin: 0;
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-xs);
      line-height: var(--pax-lh-xs);
    }

    .row-status {
      display: grid;
      justify-items: end;
      gap: 0.25rem;
    }

    .row-status small {
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-xs);
    }

    .studio-badge[data-tone='warning'] {
      background: var(--pax-color-warning-container);
      color: var(--pax-color-on-warning-container);
    }

    .studio-badge[data-tone='info'] {
      background: var(--pax-color-info-bg);
      color: var(--pax-color-info-fg);
    }

    .studio-badge[data-tone='success'] {
      background: var(--pax-color-tertiary-container);
      color: var(--pax-color-on-tertiary-container);
    }

    .studio-badge[data-tone='danger'] {
      background: var(--pax-color-error-container);
      color: var(--pax-color-on-error-container);
    }

    .row-open-btn {
      white-space: nowrap;
    }

    .reviews-state-card {
      display: grid;
      justify-items: center;
      text-align: center;
      gap: var(--pax-space-3);
      margin-inline: auto;
      max-width: 36rem;
      padding: var(--pax-space-6);
      border-radius: var(--pax-radius-lg);
      border: 1px solid var(--pax-color-outline-variant);
      background: var(--pax-color-surface);
    }

    .reviews-state-card h2 {
      margin: 0;
      font-family: var(--pax-font-display);
      font-size: var(--pax-text-md);
    }

    .reviews-state-card p {
      margin: 0;
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-sm);
    }

    .reviews-authz-section {
      display: grid;
      gap: var(--pax-space-3);
      padding-top: var(--pax-space-4);
      border-top: 1px solid var(--pax-color-outline-variant);
    }

    .reviews-authz-head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--pax-space-3);
    }

    .reviews-authz-head h2 {
      margin: 0;
      display: inline-flex;
      align-items: center;
      gap: var(--pax-space-2);
      font-family: var(--pax-font-display);
      font-size: var(--pax-text-md);
    }

    .reviews-authz-section a {
      text-decoration: none;
    }

    @media (max-width: 760px) {
      .review-row {
        grid-template-columns: auto minmax(0, 1fr);
      }

      .row-status {
        grid-column: 1 / -1;
        justify-items: start;
        display: flex;
        align-items: center;
        gap: var(--pax-space-2);
      }

      .row-open-btn {
        grid-column: 1 / -1;
        justify-self: start;
      }
    }
  `]
})
export class ReviewsPageComponent implements OnInit {
  readonly store = inject(CatalogSelectionStore);
  readonly shell = inject(StudioShellStateService);
  readonly bootstrap = inject(StudioCatalogBootstrapService);
  readonly i18n = inject(PolicyStudioI18n);
  private readonly catalog = inject(ProjectionCatalogService);
  readonly runtime = inject(RuntimeConfigService);

  readonly activeBucket = signal<ReviewBucketFilter>('ALL');
  readonly searchQuery = signal('');
  readonly authzLoading = signal(false);
  readonly authzLoaded = signal(false);
  readonly authzError = signal(false);
  readonly authzPolicies = signal<readonly ExtendedCatalogCandidate[]>([]);
  readonly knownAuthzCount = computed(() => this.store.catalogSummary()?.totalAuthorizationPolicies ?? null);
  readonly pendingAuthzPolicies = computed(() =>
    this.authzPolicies().filter(item => ['draft', 'proposed', 'approved'].includes((item.status ?? '').toLowerCase()))
  );

  readonly queueItems = computed(() => {
    const items = [...this.store.reviewQueueDecisions()];
    const priority: Readonly<Record<Exclude<WorkflowBucketId, 'STABLE'>, number>> = {
      SUBMITTED: 0,
      APPROVED: 1,
      REJECTED: 2,
      OPEN: 3
    };
    return items.sort((a, b) => {
      const ba = classifyDecisionWorkflowBucket(a) as Exclude<WorkflowBucketId, 'STABLE'>;
      const bb = classifyDecisionWorkflowBucket(b) as Exclude<WorkflowBucketId, 'STABLE'>;
      return priority[ba] - priority[bb] || a.name.localeCompare(b.name);
    });
  });

  readonly bucketTabs = computed(() => {
    const items = this.queueItems();
    const countOf = (bucket: Exclude<WorkflowBucketId, 'STABLE'>) =>
      items.filter(item => classifyDecisionWorkflowBucket(item) === bucket).length;
    return [
      { id: 'ALL' as const, label: this.i18n.text('reviewsTabAll'), count: items.length },
      { id: 'SUBMITTED' as const, label: this.i18n.text('reviewsTabSubmitted'), count: countOf('SUBMITTED') },
      { id: 'OPEN' as const, label: this.i18n.text('reviewsTabOpen'), count: countOf('OPEN') },
      { id: 'APPROVED' as const, label: this.i18n.text('reviewsTabApproved'), count: countOf('APPROVED') },
      { id: 'REJECTED' as const, label: this.i18n.text('reviewsTabRejected'), count: countOf('REJECTED') }
    ];
  });

  readonly filteredItems = computed(() => {
    const bucket = this.activeBucket();
    const query = this.searchQuery().trim().toLowerCase();
    return this.queueItems().filter(item => {
      if (bucket !== 'ALL' && classifyDecisionWorkflowBucket(item) !== bucket) {
        return false;
      }
      if (!query) return true;
      const docTitle =
        item.workspaceDocumentation?.title
        ?? item.documentation?.title
        ?? item.definitionDocumentation?.title
        ?? '';
      return `${item.name} ${docTitle} ${item.code} ${item.key} ${item.ruleSet} ${item.domain}`
        .toLowerCase()
        .includes(query);
    });
  });

  ngOnInit(): void {
    this.shell.setActiveNavItem('reviews');
    this.shell.setBreadcrumbs([{ label: this.i18n.text('navItemReviews') }]);
    this.bootstrap.ensureLoaded();
  }

  displayTitle(decision: DecisionSummary): string {
    const docTitle =
      decision.workspaceDocumentation?.title
      ?? decision.documentation?.title
      ?? decision.definitionDocumentation?.title;
    return humanizeDecisionTitle(
      decision.name,
      decision.code,
      docTitle,
      this.shell.viewDepth(),
      this.i18n.locale()
    );
  }

  displayScope(decision: DecisionSummary): string {
    const raw = decision.ruleSet?.trim() || decision.domain?.trim() || '';
    if (!raw || this.shell.viewDepth() === 'technical' || !looksLikeTechnicalSlug(raw)) {
      return raw;
    }
    return humanizeTechnicalSlug(raw, 2, this.i18n.locale()) || raw;
  }

  bucketTone(decision: DecisionSummary): 'warning' | 'info' | 'success' | 'danger' {
    switch (classifyDecisionWorkflowBucket(decision)) {
      case 'SUBMITTED':
        return 'warning';
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'danger';
      default:
        return 'info';
    }
  }

  bucketLabel(decision: DecisionSummary): string {
    switch (classifyDecisionWorkflowBucket(decision)) {
      case 'SUBMITTED':
        return this.i18n.text('workspaceStateSubmitted');
      case 'APPROVED':
        return this.i18n.text('workspaceStateApproved');
      case 'REJECTED':
        return this.i18n.text('workspaceStateRejected');
      default:
        return this.i18n.text('workspaceStateOpen');
    }
  }

  autonomyIcon(decision: DecisionSummary): StudioIconName {
    switch (decision.slotOverridePolicy) {
      case 'PARAMETERIZABLE':
        return 'sliders';
      case 'RESTRICT_ONLY':
      case 'EXTEND_ONLY':
      case 'REPLACEABLE':
        return 'pencil';
      case 'FORBIDDEN':
      case 'LOCKED':
        return 'lock';
      default:
        return 'file-edit';
    }
  }

  rememberReturnRoute(): void {
    this.store.postLoginReturnRoute.set('/reviews');
  }

  openInCatalog(decision: DecisionSummary): void {
    const bucket = classifyDecisionWorkflowBucket(decision);
    const targetMode: DecisionWorkMode =
      bucket === 'SUBMITTED' || bucket === 'APPROVED' ? 'operate' : 'rule';
    this.bootstrap.requestOpenInCatalog(decision, targetMode);
  }

  loadAuthzQueue(): void {
    const state = this.runtime.state();
    if (state.kind !== 'ready' || state.config.mode !== 'remote' || this.authzLoading()) return;
    if (typeof this.catalog.browseAccessCatalog !== 'function') return;
    this.authzLoading.set(true);
    this.authzError.set(false);
    const limit = this.store.catalogSummary() !== null ? 50 : 12;
    this.catalog.browseAccessCatalog(state.config, { page: 0, limit }).subscribe({
      next: page => {
        this.authzLoading.set(false);
        this.authzLoaded.set(true);
        this.authzPolicies.set(page.candidates);
      },
      error: () => {
        this.authzLoading.set(false);
        this.authzError.set(true);
      }
    });
  }
}
