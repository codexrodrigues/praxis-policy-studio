import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import {
  buildCatalogPortfolioSummary,
  classifyDecisionWorkflowBucket,
  type CatalogPortfolioSummary,
  type PortfolioDomainCard
} from '../../core/catalog-portfolio';
import { humanizeDecisionTitle, humanizeTechnicalSlug, looksLikeTechnicalSlug } from '../../core/humanize-labels';
import { PolicyStudioI18n } from '../../core/i18n';
import type { DomainRuleCatalogSummary } from '../../core/projection-catalog.service';
import type { StudioViewDepth } from '../../core/studio-shell-state.service';
import { StudioIconComponent } from '../../shared/studio-icon.component';
import type { DecisionSummary } from './catalog.fixture';

@Component({
  selector: 'pax-catalog-portfolio-overview',
  standalone: true,
  imports: [StudioIconComponent],
  template: `
<section class="portfolio-overview" data-testid="catalog-portfolio-overview" aria-labelledby="portfolio-title">
  @let portfolio = summary();
  <header class="portfolio-header">
    <div class="portfolio-heading-copy">
      <p class="eyebrow">
        <pax-icon name="layout-grid" [size]="14" />
        <span>{{ i18n.text('portfolioEyebrow') }}</span>
      </p>
      <h1 id="portfolio-title">{{ i18n.text('portfolioTitle') }}</h1>
      <p class="portfolio-subtitle">{{ i18n.text('portfolioSubtitle') }}</p>
    </div>
    <div class="portfolio-header-actions">
      <ng-content select="[overviewHeaderActions]" />
      @if (selectedSignal()) {
        <button
          type="button"
          class="quiet-button"
          data-testid="portfolio-back-to-decision"
          (click)="closeRequested.emit()">
          <pax-icon name="arrow-left" [size]="14" />
          <span>{{ i18n.text('portfolioBackToDecision') }}</span>
        </button>
      }
    </div>
  </header>

  <div class="kpi-strip" role="group" [attr.aria-label]="i18n.text('portfolioEyebrow')">
    <div class="kpi-tile" data-testid="portfolio-kpi-total">
      <span class="kpi-label">{{ i18n.text('portfolioKpiTotalRules') }}</span>
      <strong class="kpi-value studio-mono">{{ portfolio.totalRules }}</strong>
    </div>
    <div class="kpi-tile" data-testid="portfolio-kpi-domains">
      <span class="kpi-label">{{ i18n.text('portfolioKpiDomains') }}</span>
      <strong class="kpi-value studio-mono">{{ portfolio.domainCount }}</strong>
    </div>
    <div class="kpi-tile" data-testid="portfolio-kpi-functionalities">
      <span class="kpi-label">{{ i18n.text('portfolioKpiFunctionalities') }}</span>
      <strong class="kpi-value studio-mono">{{ portfolio.functionalityCount }}</strong>
    </div>
    @if (activeWorkCount() > 0) {
      <button
        type="button"
        class="kpi-tile kpi-interactive"
        data-testid="portfolio-kpi-active-work"
        (click)="workflowQueueFilterRequested.emit()">
        <span class="kpi-label">
          <pax-icon name="activity" [size]="14" />
          <span>{{ i18n.text('portfolioKpiActiveWork') }}</span>
        </span>
        <strong class="kpi-value studio-mono">{{ activeWorkCount() }}</strong>
      </button>
    } @else {
      <div class="kpi-tile" data-testid="portfolio-kpi-active-work">
        <span class="kpi-label">{{ i18n.text('portfolioKpiActiveWork') }}</span>
        <strong class="kpi-value studio-mono">0</strong>
      </div>
    }
  </div>

  @if (portfolio.activeWorkflowDecisions.length > 0) {
    <section class="portfolio-section" data-testid="portfolio-active-queue" aria-labelledby="portfolio-queue-title">
      <div class="section-head">
        <div>
          <h2 id="portfolio-queue-title">{{ i18n.text('portfolioActiveQueueTitle') }}</h2>
          <p>{{ i18n.text('portfolioActiveQueueHint') }}</p>
        </div>
        @if (portfolio.activeWorkflowDecisions.length > 6) {
          <button
            type="button"
            class="quiet-button"
            data-testid="portfolio-queue-view-all"
            (click)="workflowQueueFilterRequested.emit()">
            {{ i18n.text('showAllDecisions') }} ({{ portfolio.activeWorkflowDecisions.length }})
          </button>
        }
      </div>
      <div class="queue-list">
        @for (item of portfolio.activeWorkflowDecisions.slice(0, 6); track item.key) {
          <button
            type="button"
            class="queue-row"
            [attr.data-testid]="'portfolio-queue-item-' + item.key"
            (click)="decisionSelected.emit(item)">
            <span class="queue-copy">
              <strong>{{ displayDecisionTitle(item) }}</strong>
              @if (displayDecisionScope(item); as scopeLabel) {
                <small>{{ scopeLabel }}</small>
              }
            </span>
            <span class="queue-badge" [attr.data-tone]="workflowBadgeTone(item)">
              {{ workflowBadgeLabel(item) }}
            </span>
          </button>
        }
      </div>
    </section>
  }

  <section class="portfolio-section" aria-labelledby="portfolio-tabs-label">
    <div class="portfolio-tabs-bar">
      <span class="visually-hidden" id="portfolio-tabs-label">
        {{ activeTab() === 'domains' ? i18n.text('portfolioTabDomains') : i18n.text('portfolioTabTypes') }}
      </span>
      <div class="portfolio-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          data-testid="portfolio-tab-domains"
          [class.active]="activeTab() === 'domains'"
          [attr.aria-selected]="activeTab() === 'domains'"
          (click)="activeTab.set('domains')">
          <pax-icon name="layout-grid" [size]="14" />
          <span>{{ i18n.text('portfolioTabDomains') }}</span>
        </button>
        <button
          type="button"
          role="tab"
          data-testid="portfolio-tab-types"
          [class.active]="activeTab() === 'types'"
          [attr.aria-selected]="activeTab() === 'types'"
          (click)="activeTab.set('types')">
          <pax-icon name="layers" [size]="14" />
          <span>{{ i18n.text('portfolioTabTypes') }}</span>
        </button>
      </div>
    </div>

    @if (activeTab() === 'domains') {
      @if (portfolio.domains.length > 12) {
        <div class="portfolio-domain-toolbar">
          <label class="portfolio-domain-search">
            <pax-icon name="search" [size]="14" />
            <span class="visually-hidden">{{ i18n.text('portfolioDomainSearchPlaceholder') }}</span>
            <input
              type="search"
              data-testid="portfolio-domain-search"
              [value]="domainQuery()"
              [placeholder]="i18n.text('portfolioDomainSearchPlaceholder')"
              (input)="domainQuery.set($any($event.target).value)" />
          </label>
        </div>
      }
      <div class="domain-grid" data-testid="portfolio-domain-grid">
        @for (domain of filteredDomains(); track domain.domainKey) {
          <article class="domain-card" [attr.data-testid]="'portfolio-domain-' + domain.domainKey">
            <header class="domain-card-head">
              <div class="domain-card-copy">
                <h3>{{ domain.label }}</h3>
                <span class="domain-counts studio-mono">{{ countWithUnit(domain.totalCount) }}</span>
              </div>
              <button
                type="button"
                class="domain-explore-btn"
                [attr.data-testid]="'portfolio-explore-domain-' + domain.domainKey"
                (click)="scopeSelected.emit(domain.domainKey)">
                <span>{{ i18n.text('portfolioOpenDomain') }}</span>
                <pax-icon name="arrow-right" [size]="14" />
              </button>
            </header>

            @if (hasDistinctFunctionalities(domain)) {
              <ul class="functionality-list">
                @for (func of domain.functionalities.slice(0, 5); track func.scopeKey) {
                  <li>
                    <button
                      type="button"
                      class="functionality-row"
                      [attr.data-testid]="'portfolio-func-' + func.scopeKey"
                      (click)="scopeSelected.emit(func.scopeKey)">
                      <span class="functionality-name" [attr.title]="func.label">{{ displayFunctionalityLabel(domain, func.label) }}</span>
                      <span class="functionality-count studio-mono">{{ func.count }}</span>
                    </button>
                  </li>
                }
              </ul>

              @if (domain.functionalities.length > 5) {
                <p class="domain-more-note">
                  {{ moreFunctionalitiesText(domain.functionalities.length - 5) }}
                </p>
              }
            }
          </article>
        } @empty {
          <p class="portfolio-domain-empty" data-testid="portfolio-domain-search-empty">{{ i18n.text('portfolioDomainSearchEmpty') }}</p>
        }
      </div>
    } @else {
      <div class="rule-type-grid" data-testid="portfolio-type-grid">
        @for (typeItem of portfolio.ruleTypes; track typeItem.ruleType) {
          <button
            type="button"
            class="rule-type-card"
            [attr.data-testid]="'portfolio-type-' + typeItem.ruleType"
            (click)="ruleTypeSelected.emit(typeItem.ruleType)">
            <div class="rule-type-head">
              <span class="rule-type-title">
                <pax-icon name="layers" [size]="16" />
                <strong>{{ typeItem.label }}</strong>
              </span>
              <span class="rule-type-count studio-mono">{{ countWithUnit(typeItem.count) }}</span>
            </div>
            <div class="rule-type-bar-track" aria-hidden="true">
              <span class="rule-type-bar-fill" [style.width.%]="typeItem.percentage"></span>
            </div>
            <span class="rule-type-action">
              <span>{{ i18n.text('portfolioFilterTypeAction') }}</span>
              <pax-icon name="arrow-right" [size]="14" />
            </span>
          </button>
        }

        @if (portfolio.ruleTypes.length === 1 && portfolio.domains.length > 1) {
          <section class="single-type-context-card" data-testid="portfolio-single-type-context">
            <div class="single-type-context-head">
              <strong>{{ i18n.text('portfolioSingleTypeSummaryTitle') }}</strong>
              <span class="single-type-status-pills">
                <span class="studio-badge">{{ i18n.text('workflowBucketStable') }}: {{ portfolio.totalRules - portfolio.activeWorkflowDecisions.length }}</span>
                <span class="studio-badge">{{ i18n.text('portfolioKpiActiveWork') }}: {{ portfolio.activeWorkflowDecisions.length }}</span>
              </span>
            </div>
            <p class="single-type-domains-label">{{ i18n.text('portfolioTopDomainsTitle') }}</p>
            <div class="single-type-domain-chips">
              @for (domain of portfolio.domains.slice(0, 6); track domain.domainKey) {
                <button
                  type="button"
                  class="quiet-button single-type-domain-btn"
                  (click)="scopeSelected.emit(domain.domainKey)">
                  <span>{{ domain.label }}</span>
                  <span class="studio-mono">{{ domain.totalCount }}</span>
                </button>
              }
            </div>
          </section>
        }
      </div>
    }
  </section>
</section>`,
  styles: [`
:host {
  display: block;
  min-width: 0;
}

.portfolio-overview {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--pax-space-6);
  width: 100%;
  max-width: 68rem;
  min-width: 0;
}

.portfolio-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--pax-space-3) var(--pax-space-4);
  padding-bottom: var(--pax-space-4);
  border-bottom: 1px solid var(--pax-color-outline-variant);
}

.portfolio-header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--pax-space-2);
}

.portfolio-header-actions ::ng-deep .refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--pax-space-2);
}

.portfolio-heading-copy {
  display: grid;
  gap: var(--pax-space-2);
  min-width: 0;
}

.eyebrow {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--pax-color-primary);
  font-size: var(--pax-text-xs);
  line-height: var(--pax-lh-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.portfolio-header h1 {
  margin: 0;
  font-family: var(--pax-font-display);
  font-size: clamp(var(--pax-text-lg), 2.2vw, var(--pax-text-xl));
  line-height: var(--pax-lh-xl);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.portfolio-subtitle {
  margin: 0;
  max-width: 54ch;
  color: var(--pax-color-on-surface-variant);
  font-size: var(--pax-text-base);
  line-height: var(--pax-lh-base);
}

.kpi-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 8.75rem), 1fr));
  gap: var(--pax-space-3);
  min-width: 0;
}

.kpi-tile {
  display: grid;
  gap: var(--pax-space-1);
  padding: var(--pax-space-4);
  border-radius: var(--pax-radius-lg);
  border: 1px solid var(--pax-color-outline-variant);
  background: var(--pax-color-surface-container-low);
  text-align: left;
  color: inherit;
}

button.kpi-interactive {
  cursor: pointer;
  border-color: color-mix(in oklab, var(--pax-color-primary) 42%, var(--pax-color-outline-variant));
  background: color-mix(in oklab, var(--pax-color-primary-container) 36%, var(--pax-color-surface-container-low));
  transition: border-color 140ms ease, background-color 140ms ease;
}

button.kpi-interactive:hover {
  border-color: var(--pax-color-primary);
  background: var(--pax-color-primary-container);
}

button.kpi-interactive:focus-visible,
.portfolio-tabs button:focus-visible,
.queue-row:focus-visible,
.domain-explore-btn:focus-visible,
.functionality-row:focus-visible,
.rule-type-card:focus-visible {
  outline: 2px solid var(--pax-color-primary);
  outline-offset: 2px;
}

.kpi-label {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--pax-color-on-surface-variant);
  font-size: var(--pax-text-xs);
  line-height: var(--pax-lh-xs);
  font-weight: 600;
}

.kpi-value {
  font-family: var(--pax-font-display);
  font-size: var(--pax-text-xl);
  line-height: 1.15;
  font-weight: 700;
  color: var(--pax-color-on-surface);
}

.portfolio-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--pax-space-3);
  min-width: 0;
}

.section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--pax-space-2) var(--pax-space-4);
}

.section-head h2 {
  margin: 0;
  font-family: var(--pax-font-display);
  font-size: var(--pax-text-md);
  line-height: var(--pax-lh-md);
  font-weight: 700;
}

.section-head p {
  margin: var(--pax-space-1) 0 0;
  color: var(--pax-color-on-surface-variant);
  font-size: var(--pax-text-sm);
  line-height: var(--pax-lh-sm);
}

.queue-list {
  display: grid;
  gap: var(--pax-space-2);
}

.queue-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pax-space-3);
  padding: var(--pax-space-3) var(--pax-space-4);
  border: 1px solid var(--pax-color-outline-variant);
  border-radius: var(--pax-radius-md);
  background: var(--pax-color-surface-container-low);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.queue-row:hover {
  background: var(--pax-color-surface-container);
  border-color: var(--pax-color-outline);
}

.queue-copy {
  display: grid;
  gap: 0.125rem;
  min-width: 0;
}

.queue-copy strong {
  font-size: var(--pax-text-sm);
  line-height: var(--pax-lh-sm);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.queue-copy small {
  color: var(--pax-color-on-surface-variant);
  font-size: var(--pax-text-xs);
  line-height: var(--pax-lh-xs);
}

.queue-badge {
  flex-shrink: 0;
  padding: 0.125rem var(--pax-space-2);
  border-radius: var(--pax-radius-pill);
  font-size: var(--pax-text-xs);
  line-height: var(--pax-lh-xs);
  font-weight: 700;
  background: var(--pax-policy-param-bg);
  color: var(--pax-policy-param-fg);
}

.queue-badge[data-tone='warning'] {
  background: var(--pax-color-warning-container);
  color: var(--pax-color-on-warning-container);
}

.queue-badge[data-tone='success'] {
  background: var(--pax-policy-custom-bg);
  color: var(--pax-policy-custom-fg);
}

.queue-badge[data-tone='danger'] {
  background: var(--pax-color-error-container);
  color: var(--pax-color-on-error-container);
}

.portfolio-tabs-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--pax-color-outline-variant);
}

.portfolio-tabs {
  display: inline-flex;
  align-items: center;
  gap: var(--pax-space-1);
}

.portfolio-tabs button {
  display: inline-flex;
  align-items: center;
  gap: var(--pax-space-2);
  min-height: 2.5rem;
  border: 0;
  border-bottom: 2px solid transparent;
  padding: var(--pax-space-2) var(--pax-space-3);
  background: transparent;
  color: var(--pax-color-on-surface-variant);
  font: inherit;
  font-size: var(--pax-text-sm);
  font-weight: 600;
  cursor: pointer;
}

.portfolio-tabs button.active {
  color: var(--pax-color-primary);
  border-bottom-color: var(--pax-color-primary);
  font-weight: 700;
}

.domain-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 17.5rem), 1fr));
  gap: var(--pax-space-4);
  min-width: 0;
}

.domain-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: var(--pax-space-3);
  padding: var(--pax-space-4);
  border: 1px solid var(--pax-color-outline-variant);
  border-radius: var(--pax-radius-lg);
  background: var(--pax-color-surface-container-low);
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.domain-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--pax-space-2);
  padding-bottom: var(--pax-space-2);
  border-bottom: 1px solid color-mix(in oklab, var(--pax-color-outline-variant) 65%, transparent);
  min-width: 0;
}

.domain-card-copy {
  display: grid;
  gap: 0.125rem;
  min-width: 0;
}

.domain-card-copy h3 {
  margin: 0;
  font-family: var(--pax-font-display);
  font-size: var(--pax-text-base);
  line-height: 1.35;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.domain-counts {
  color: var(--pax-color-on-surface-variant);
  font-size: var(--pax-text-xs);
  line-height: var(--pax-lh-xs);
  font-weight: 600;
}

.domain-explore-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  border: 1px solid var(--pax-color-outline-variant);
  border-radius: var(--pax-radius-sm);
  padding: 0.25rem var(--pax-space-2);
  background: var(--pax-color-surface);
  color: var(--pax-color-primary);
  font-size: var(--pax-text-xs);
  line-height: var(--pax-lh-xs);
  font-weight: 700;
  cursor: pointer;
}

.domain-explore-btn:hover {
  border-color: var(--pax-color-primary);
  background: var(--pax-color-primary-container);
  color: var(--pax-color-on-primary-container);
}

.functionality-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--pax-space-1);
  min-width: 0;
}

.functionality-list > li {
  min-width: 0;
}

.functionality-row {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pax-space-2);
  border: 0;
  border-radius: var(--pax-radius-sm);
  padding: var(--pax-space-2);
  background: var(--pax-color-surface);
  color: inherit;
  font: inherit;
  font-size: var(--pax-text-sm);
  line-height: var(--pax-lh-sm);
  text-align: left;
  cursor: pointer;
}

.functionality-row:hover {
  background: var(--pax-color-primary-container);
  color: var(--pax-color-on-primary-container);
}

.functionality-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.functionality-count {
  flex-shrink: 0;
  padding: 0.0625rem var(--pax-space-2);
  border-radius: var(--pax-radius-pill);
  background: var(--pax-color-surface-container);
  color: var(--pax-color-on-surface-variant);
  font-size: var(--pax-text-xs);
  font-weight: 700;
}

.domain-more-note {
  margin: 0;
  color: var(--pax-color-on-surface-variant);
  font-size: var(--pax-text-xs);
  line-height: var(--pax-lh-xs);
  font-weight: 600;
}

.rule-type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
  gap: var(--pax-space-3);
  min-width: 0;
}

.rule-type-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--pax-space-3);
  padding: var(--pax-space-4);
  border: 1px solid var(--pax-color-outline-variant);
  border-radius: var(--pax-radius-lg);
  background: var(--pax-color-surface-container-low);
  color: inherit;
  text-align: left;
  cursor: pointer;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.rule-type-card:hover {
  border-color: var(--pax-color-primary);
  background: var(--pax-color-surface);
}

.rule-type-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pax-space-2);
}

.rule-type-title {
  display: inline-flex;
  align-items: center;
  gap: var(--pax-space-2);
  font-size: var(--pax-text-base);
}

.rule-type-count {
  color: var(--pax-color-on-surface-variant);
  font-size: var(--pax-text-xs);
  font-weight: 700;
}

.rule-type-bar-track {
  height: 0.375rem;
  border-radius: var(--pax-radius-pill);
  background: var(--pax-color-surface-container);
  overflow: hidden;
}

.rule-type-bar-fill {
  display: block;
  height: 100%;
  border-radius: var(--pax-radius-pill);
  background: var(--pax-color-primary);
}

.rule-type-action {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--pax-color-primary);
  font-size: var(--pax-text-xs);
  font-weight: 700;
}

.portfolio-domain-toolbar {
  display: flex;
  justify-content: flex-start;
}

.portfolio-domain-search {
  display: inline-flex;
  align-items: center;
  gap: var(--pax-space-2);
  width: min(100%, 24rem);
  padding: 0.35rem 0.65rem;
  border: 1px solid var(--pax-color-outline-variant);
  border-radius: var(--pax-radius-md);
  background: var(--pax-color-surface);
  color: var(--pax-color-on-surface-variant);
}

.portfolio-domain-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--pax-color-on-surface);
  font: inherit;
  font-size: var(--pax-text-sm);
}

.portfolio-domain-empty {
  color: var(--pax-color-on-surface-variant);
  font-size: var(--pax-text-sm);
}

.single-type-context-card {
  display: grid;
  gap: var(--pax-space-3);
  padding: var(--pax-space-4);
  border: 1px solid var(--pax-color-outline-variant);
  border-radius: var(--pax-radius-lg);
  background: var(--pax-color-surface);
}

.single-type-context-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--pax-space-2);
}

.single-type-status-pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--pax-space-2);
}

.single-type-domains-label {
  margin: 0;
  color: var(--pax-color-on-surface-variant);
  font-size: var(--pax-text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.single-type-domain-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--pax-space-2);
}

.single-type-domain-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--pax-space-2);
  font-size: var(--pax-text-xs);
}
`],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CatalogPortfolioOverviewComponent {
  readonly i18n = inject(PolicyStudioI18n);

  readonly decisionsSignal = signal<readonly DecisionSummary[]>([]);
  readonly selectedSignal = signal<DecisionSummary | null>(null);
  readonly viewDepthSignal = signal<StudioViewDepth>('business');
  readonly serverSummarySignal = signal<DomainRuleCatalogSummary | null>(null);
  readonly catalogStreamingSignal = signal(false);
  readonly catalogTruncatedSignal = signal(false);
  readonly activeTab = signal<'domains' | 'types'>('domains');
  readonly domainQuery = signal('');

  @Input({ required: true })
  set decisions(value: readonly DecisionSummary[]) {
    this.decisionsSignal.set(value ?? []);
  }

  @Input()
  set selected(value: DecisionSummary | null | undefined) {
    this.selectedSignal.set(value ?? null);
  }

  @Input()
  set viewDepth(value: StudioViewDepth | undefined) {
    this.viewDepthSignal.set(value ?? 'business');
  }

  @Input()
  set serverSummary(value: DomainRuleCatalogSummary | null | undefined) {
    this.serverSummarySignal.set(value ?? null);
  }

  @Input()
  set catalogStreaming(value: boolean | undefined) {
    this.catalogStreamingSignal.set(Boolean(value));
  }

  @Input()
  set catalogTruncated(value: boolean | undefined) {
    this.catalogTruncatedSignal.set(Boolean(value));
  }

  @Output() readonly scopeSelected = new EventEmitter<string>();
  @Output() readonly ruleTypeSelected = new EventEmitter<string>();
  @Output() readonly decisionSelected = new EventEmitter<DecisionSummary>();
  @Output() readonly closeRequested = new EventEmitter<void>();
  @Output() readonly workflowQueueFilterRequested = new EventEmitter<void>();

  readonly summary = computed<CatalogPortfolioSummary>(() => {
    const clientSummary = buildCatalogPortfolioSummary(
      this.decisionsSignal(),
      this.i18n.locale(),
      this.viewDepthSignal()
    );
    const server = this.serverSummarySignal();
    const useServerAuthoritative = Boolean(
      server && (this.catalogStreamingSignal() || this.catalogTruncatedSignal() || server.totalBusinessRules > clientSummary.totalRules)
    );
    if (!useServerAuthoritative || !server) {
      return clientSummary;
    }
    const serverDomains = server.byContextKey.filter(bucket => bucket.key.trim().length > 0).length;
    const serverFuncs = server.byResourceKey.filter(bucket => bucket.key.trim().length > 0).length;
    return {
      ...clientSummary,
      totalRules: server.totalBusinessRules,
      domainCount: Math.max(clientSummary.domainCount, serverDomains),
      functionalityCount: Math.max(clientSummary.functionalityCount, serverFuncs)
    };
  });

  readonly activeWorkCount = computed(() => {
    const clientCount = this.summary().activeWorkflowDecisions.length;
    const server = this.serverSummarySignal();
    if (server && (this.catalogStreamingSignal() || this.catalogTruncatedSignal())) {
      return Math.max(clientCount, server.reviewQueue.totalPending);
    }
    return clientCount;
  });

  readonly filteredDomains = computed<readonly PortfolioDomainCard[]>(() => {
    const query = this.domainQuery().trim().toLowerCase();
    const domains = this.summary().domains;
    if (!query) return domains;
    return domains.filter(domain =>
      domain.label.toLowerCase().includes(query)
      || domain.domainKey.toLowerCase().includes(query)
      || domain.functionalities.some(func => func.label.toLowerCase().includes(query))
    );
  });

  hasDistinctFunctionalities(domain: PortfolioDomainCard): boolean {
    if (domain.functionalities.length > 1) return true;
    const single = domain.functionalities[0];
    if (!single) return false;
    return single.label.trim().toLowerCase() !== domain.label.trim().toLowerCase();
  }

  displayFunctionalityLabel(domain: PortfolioDomainCard, funcLabel: string): string {
    const trimmed = funcLabel.trim();
    if (!trimmed) return trimmed;
    const domainSegments = new Set(
      domain.label
        .split('·')
        .map(part => part.trim().toLowerCase())
        .filter(Boolean)
    );
    const funcParts = trimmed
      .split('·')
      .map(part => part.trim())
      .filter(Boolean);
    let dropCount = 0;
    while (
      dropCount < funcParts.length - 1
      && domainSegments.has(funcParts[dropCount]!.toLowerCase())
    ) {
      dropCount += 1;
    }
    return dropCount > 0 ? funcParts.slice(dropCount).join(' · ') : trimmed;
  }

  displayDecisionTitle(decision: DecisionSummary): string {
    const docTitle =
      decision.workspaceDocumentation?.title ??
      decision.documentation?.title ??
      decision.definitionDocumentation?.title;
    return humanizeDecisionTitle(
      decision.name,
      decision.code,
      docTitle,
      this.viewDepthSignal(),
      this.i18n.locale()
    );
  }

  displayDecisionScope(decision: DecisionSummary): string {
    const raw = decision.ruleSet?.trim() || decision.domain?.trim() || '';
    if (!raw || this.viewDepthSignal() === 'technical' || !looksLikeTechnicalSlug(raw)) {
      return raw;
    }
    return humanizeTechnicalSlug(raw, 2, this.i18n.locale()) || raw;
  }

  workflowBadgeTone(decision: DecisionSummary): 'warning' | 'info' | 'success' | 'danger' {
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

  workflowBadgeLabel(decision: DecisionSummary): string {
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

  countWithUnit(count: number): string {
    const unit =
      count === 1
        ? this.i18n.text('portfolioRuleSingularSuffix')
        : this.i18n.text('portfolioRulesCountSuffix');
    return `${count} ${unit}`;
  }

  moreFunctionalitiesText(hiddenCount: number): string {
    return this.i18n.format('portfolioMoreFunctionalities', { count: hiddenCount });
  }
}
