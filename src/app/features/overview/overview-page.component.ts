import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PolicyStudioI18n } from '../../core/i18n';
import { StudioCatalogBootstrapService } from '../../core/studio-catalog-bootstrap.service';
import { StudioShellStateService } from '../../core/studio-shell-state.service';
import { StudioIconComponent } from '../../shared/studio-icon.component';
import { CatalogPortfolioOverviewComponent } from '../catalog/catalog-portfolio-overview.component';
import { CatalogSelectionStore } from '../catalog/catalog-selection.store';
import type { DecisionSummary } from '../catalog/catalog.fixture';

@Component({
  selector: 'pax-overview-page',
  standalone: true,
  imports: [RouterLink, CatalogPortfolioOverviewComponent, StudioIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-shell">
      @if (store.allDecisions().length > 0) {
        <pax-catalog-portfolio-overview
          [decisions]="store.allDecisions()"
          [selected]="store.selected()"
          [viewDepth]="shell.viewDepth()"
          [serverSummary]="store.catalogSummary()"
          [catalogStreaming]="store.catalogStreaming()"
          [catalogTruncated]="store.catalogTruncated()"
          (scopeSelected)="openScopeInCatalog($event)"
          (ruleTypeSelected)="openRuleTypeInCatalog($event)"
          (decisionSelected)="openDecisionInCatalog($event)"
          (closeRequested)="returnToCatalog()"
          (workflowQueueFilterRequested)="openReviewsQueue()">
          <button
            overviewHeaderActions
            type="button"
            class="quiet-button refresh-btn"
            data-testid="overview-refresh-btn"
            [disabled]="store.loading()"
            [attr.title]="i18n.text('refreshQueueHint')"
            (click)="bootstrap.loadCatalog()">
            <pax-icon name="refresh-cw" [size]="14" />
            <span>{{ i18n.text('refreshQueueCta') }}</span>
          </button>
        </pax-catalog-portfolio-overview>
      } @else {
        <div class="overview-utility-bar">
          <button
            type="button"
            class="quiet-button refresh-btn"
            data-testid="overview-refresh-btn"
            [disabled]="store.loading()"
            [attr.title]="i18n.text('refreshQueueHint')"
            (click)="bootstrap.loadCatalog()">
            <pax-icon name="refresh-cw" [size]="14" />
            <span>{{ i18n.text('refreshQueueCta') }}</span>
          </button>
        </div>
        @if (store.loading()) {
          <div class="state-card" aria-live="polite">
            <p class="studio-eyebrow">{{ i18n.text('navItemOverview') }}</p>
            <h1>{{ i18n.text('portfolioTitle') }}</h1>
            <p class="state-copy">{{ i18n.text('loading') }}</p>
          </div>
        } @else if (store.authenticationRequired()) {
          <div class="state-card" data-testid="overview-auth-card">
            <p class="studio-eyebrow">{{ i18n.text('navItemOverview') }}</p>
            <h1>{{ i18n.text('portfolioTitle') }}</h1>
            <p class="state-copy">{{ i18n.text('overviewAuthPrompt') }}</p>
            <a
              class="primary-action"
              routerLink="/catalog"
              queryParamsHandling="preserve"
              (click)="rememberReturnRoute()">
              {{ i18n.text('reviewsGoToCatalogCta') }}
            </a>
          </div>
        } @else if (store.permissionLimited()) {
          <div class="state-card" data-testid="overview-permission-card" role="status">
            <p class="studio-eyebrow">{{ i18n.text('navItemOverview') }}</p>
            <h1>{{ i18n.text('portfolioTitle') }}</h1>
            <p class="state-copy">{{ i18n.text('permissionLimited') }}</p>
          </div>
        } @else if (store.loadError()) {
          <div class="state-card" role="alert">
            <p class="studio-eyebrow">{{ i18n.text('navItemOverview') }}</p>
            <h1>{{ i18n.text('projectionUnavailable') }}</h1>
            <p class="state-copy">{{ i18n.text('remoteError') }}</p>
            <button type="button" class="quiet-button" (click)="bootstrap.loadCatalog()">
              {{ i18n.text('retryCatalog') }}
            </button>
          </div>
        } @else {
          <div class="state-card">
            <p class="studio-eyebrow">{{ i18n.text('navItemOverview') }}</p>
            <h1>{{ i18n.text('portfolioTitle') }}</h1>
            <p class="state-copy">{{ i18n.text('noResults') }}</p>
          </div>
        }
      }
    </section>
  `,
  styles: [`
    :host {
      display: block;
      min-width: 0;
    }

    .page-shell {
      max-width: 82rem;
      margin-inline: auto;
      padding: clamp(1.25rem, 2.5vw, var(--pax-space-8)) clamp(1rem, 3vw, var(--pax-space-10));
      display: grid;
      gap: var(--pax-space-3);
    }

    .overview-utility-bar {
      display: flex;
      justify-content: flex-end;
    }

    .refresh-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--pax-space-2);
    }

    .state-card {
      display: grid;
      justify-items: start;
      gap: var(--pax-space-3);
      max-width: 38rem;
      padding: var(--pax-space-6);
      border-radius: var(--pax-radius-lg);
      border: 1px solid var(--pax-color-outline-variant);
      background: var(--pax-color-surface);
    }

    .state-card h1 {
      margin: 0;
      font-family: var(--pax-font-display);
      font-size: var(--pax-text-lg);
      line-height: var(--pax-lh-lg);
    }

    .state-copy {
      margin: 0;
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-sm);
      line-height: var(--pax-lh-sm);
    }

    .state-card a {
      text-decoration: none;
    }
  `]
})
export class OverviewPageComponent implements OnInit {
  readonly store = inject(CatalogSelectionStore);
  readonly shell = inject(StudioShellStateService);
  readonly bootstrap = inject(StudioCatalogBootstrapService);
  readonly i18n = inject(PolicyStudioI18n);

  ngOnInit(): void {
    this.shell.setActiveNavItem('overview');
    this.shell.setBreadcrumbs([{ label: this.i18n.text('navItemOverview') }]);
    this.bootstrap.ensureLoaded();
  }

  rememberReturnRoute(): void {
    this.store.postLoginReturnRoute.set('/overview');
  }

  openScopeInCatalog(scopeKey: string): void {
    const normalized = scopeKey.trim();
    if (!normalized) return;
    this.store.deepLinkConsumed.set(true);
    this.store.contextScopeFilter.set(normalized);
    this.store.activeRuleTypeFilter.set(null);
    const matching = this.store.decisions();
    const current = this.store.selected();
    if (matching.length > 0 && (!current || !matching.some(item => item.key === current.key))) {
      this.bootstrap.requestOpenInCatalog(matching[0]!);
      return;
    }
    this.shell.navigateToRoute('/catalog');
  }

  openRuleTypeInCatalog(ruleType: string): void {
    const normalized = ruleType.trim();
    if (!normalized) return;
    this.store.deepLinkConsumed.set(true);
    this.store.contextScopeFilter.set(null);
    this.store.activeRuleTypeFilter.set(normalized);
    this.store.explorerGlobalLens.set('type');
    const matching = this.store.decisions();
    const current = this.store.selected();
    if (matching.length > 0 && (!current || !matching.some(item => item.key === current.key))) {
      this.bootstrap.requestOpenInCatalog(matching[0]!);
      return;
    }
    this.shell.navigateToRoute('/catalog');
  }

  openDecisionInCatalog(decision: DecisionSummary): void {
    this.bootstrap.requestOpenInCatalog(decision, 'understand');
  }

  returnToCatalog(): void {
    this.shell.navigateToRoute('/catalog');
  }

  openReviewsQueue(): void {
    this.shell.navigateToRoute('/reviews');
  }
}
