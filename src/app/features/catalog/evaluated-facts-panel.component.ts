import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import {
  groupFactsForDisplay,
  partitionDecisionFacts
} from '../../core/fact-presentation';
import { PolicyStudioI18n } from '../../core/i18n';
import type { RuleParameterDisplayEntry } from '../../core/rule-parameters-display';
import type { StudioViewDepth } from '../../core/studio-shell-state.service';
import { StudioIconComponent } from '../../shared/studio-icon.component';
import { TermPopoverComponent } from '../../shared/term-popover.component';
import type { DecisionSummary } from './catalog.fixture';

@Component({
  selector: 'pax-evaluated-facts-panel',
  standalone: true,
  imports: [StudioIconComponent, TermPopoverComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let current = decisionSignal();
    @let partitioned = partitionedFacts();
    @let activeGroups = evaluatedGroups();
    @let catalogGroups = catalogOnlyGroups();
    @let paramEntries = parametersSignal();

    @if (current) {
      <section
        class="evaluated-facts-strip"
        data-testid="evaluated-facts-strip"
        [attr.aria-label]="i18n.text('evaluatedFactsHeading')">
        <div class="facts-strip-header">
          <p class="section-label">{{ i18n.text('evaluatedFactsHeading') }}</p>
          @if (current.facts.length > 0) {
            <span class="facts-scope-pill" data-testid="evaluated-facts-scope-badge">
              @if (partitioned.scopedByRule) {
                {{ i18n.format('evaluatedFactsScopeCount', { used: partitioned.evaluatedFacts.length, total: current.facts.length }) }}
              } @else {
                {{ i18n.format('evaluatedFactsCountOnly', { count: partitioned.evaluatedFacts.length }) }}
              }
            </span>
          }
        </div>

        @if (partitioned.evaluatedFacts.length > 0) {
          @if (shouldShowGroupRows(activeGroups)) {
            <div class="fact-groups-list" data-testid="evaluated-fact-groups">
              @for (groupEntry of activeGroups; track groupEntry.group.key) {
                <div class="fact-group-row" [attr.data-testid]="'fact-group-' + groupEntry.group.key">
                  <span class="fact-group-heading">
                    <pax-icon [name]="groupEntry.group.icon" [size]="12" />
                    <span>{{ groupEntry.group.label }}</span>
                  </span>
                  <ul class="fact-chip-list">
                    @for (item of groupEntry.items; track item.fact.path) {
                      <li>
                        <pax-term-popover
                          variant="chip"
                          icon="database"
                          [tone]="item.popover.tone"
                          [term]="item.popover.chipLabel"
                          [badge]="item.popover.requiredBadge"
                          [category]="item.popover.category"
                          [title]="item.popover.title"
                          [summary]="item.popover.summary"
                          [hint]="item.popover.hint"
                          [hintLabel]="i18n.text('factHintHeading')"
                          [metaTags]="item.popover.metaTags"
                          [detail]="item.popover.detail" />
                      </li>
                    }
                  </ul>
                </div>
              }
            </div>
          } @else {
            <ul class="fact-chip-list">
              @for (item of activeGroups[0].items; track item.fact.path) {
                <li>
                  <pax-term-popover
                    variant="chip"
                    icon="database"
                    [tone]="item.popover.tone"
                    [term]="item.popover.chipLabel"
                    [badge]="item.popover.requiredBadge"
                    [category]="item.popover.category"
                    [title]="item.popover.title"
                    [summary]="item.popover.summary"
                    [hint]="item.popover.hint"
                    [hintLabel]="i18n.text('factHintHeading')"
                    [metaTags]="item.popover.metaTags"
                    [detail]="item.popover.detail" />
                </li>
              }
            </ul>
          }
        } @else {
          <p class="didactic-empty-value">{{ i18n.text('evaluatedFactsEmpty') }}</p>
        }

        @if (partitioned.catalogOnlyFacts.length > 0) {
          <div class="catalog-only-section">
            <button
              type="button"
              class="catalog-only-toggle"
              data-testid="evaluated-facts-catalog-toggle"
              [attr.aria-expanded]="catalogExpanded()"
              (click)="toggleCatalogFacts()">
              <pax-icon name="layers" [size]="14" />
              <span>
                {{ i18n.format(catalogExpanded() ? 'evaluatedFactsOtherToggleClose' : 'evaluatedFactsOtherToggleOpen', { count: partitioned.catalogOnlyFacts.length }) }}
              </span>
              <pax-icon
                class="toggle-chevron"
                [class.open]="catalogExpanded()"
                name="chevron-down"
                [size]="14" />
            </button>

            @if (catalogExpanded()) {
              <div class="catalog-only-facts-panel" data-testid="evaluated-facts-catalog-panel">
                <p class="catalog-only-hint">{{ i18n.text('evaluatedFactsOtherHint') }}</p>
                <div class="fact-groups-list">
                  @for (groupEntry of catalogGroups; track groupEntry.group.key) {
                    <div class="fact-group-row" [attr.data-testid]="'catalog-fact-group-' + groupEntry.group.key">
                      <span class="fact-group-heading">
                        <pax-icon [name]="groupEntry.group.icon" [size]="12" />
                        <span>{{ groupEntry.group.label }}</span>
                      </span>
                      <ul class="fact-chip-list">
                        @for (item of groupEntry.items; track item.fact.path) {
                          <li>
                            <pax-term-popover
                              variant="chip"
                              icon="database"
                              tone="default"
                              [term]="item.popover.chipLabel"
                              [badge]="item.popover.requiredBadge"
                              [category]="item.popover.category"
                              [title]="item.popover.title"
                              [summary]="item.popover.summary"
                              [hint]="item.popover.hint"
                              [hintLabel]="i18n.text('factHintHeading')"
                              [metaTags]="item.popover.metaTags"
                              [detail]="item.popover.detail" />
                          </li>
                        }
                      </ul>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }

        @if (paramEntries.length > 0) {
          <p class="section-label evaluated-params-label">{{ i18n.text('evaluatedParametersSubheading') }}</p>
          <ul class="fact-chip-list">
            @for (param of paramEntries; track param.key) {
              <li>
                <pax-term-popover
                  variant="chip"
                  icon="sliders"
                  [tone]="param.isCustomized ? 'warning' : 'success'"
                  [term]="param.label"
                  [badge]="param.valueText"
                  [category]="i18n.text('evaluatedParametersSubheading')"
                  [title]="param.label"
                  [summary]="param.description"
                  [detail]="param.detailText" />
              </li>
            }
          </ul>
        }
      </section>
    }
  `,
  styles: [`
    :host {
      display: block;
      min-width: 0;
    }

    .evaluated-facts-strip {
      display: grid;
      gap: var(--pax-space-3);
      padding: var(--pax-space-4) 0;
      border-top: 1px solid var(--pax-color-outline-variant);
      min-width: 0;
    }

    .facts-strip-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--pax-space-2);
    }

    .facts-strip-header .section-label {
      margin: 0;
    }

    .facts-scope-pill {
      padding: 0.125rem var(--pax-space-2);
      border-radius: var(--pax-radius-pill);
      background: var(--pax-color-surface-container);
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-xs);
      font-weight: 600;
    }

    .fact-groups-list {
      display: grid;
      gap: var(--pax-space-2);
      min-width: 0;
    }

    .fact-group-row {
      display: grid;
      gap: 0.375rem;
      min-width: 0;
    }

    .fact-group-heading {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-xs);
      line-height: var(--pax-lh-xs);
      font-weight: 700;
    }

    .fact-chip-list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--pax-space-2);
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .catalog-only-section {
      display: grid;
      gap: var(--pax-space-2);
      min-width: 0;
    }

    .catalog-only-toggle {
      justify-self: start;
      display: inline-flex;
      align-items: center;
      gap: var(--pax-space-2);
      padding: 0.25rem var(--pax-space-2);
      border: 1px solid var(--pax-color-outline-variant);
      border-radius: var(--pax-radius-sm);
      background: transparent;
      color: var(--pax-color-on-surface-variant);
      font: inherit;
      font-size: var(--pax-text-xs);
      font-weight: 600;
      cursor: pointer;
    }

    .catalog-only-toggle:hover {
      background: var(--pax-color-surface-container-low);
      color: var(--pax-color-on-surface);
    }

    .catalog-only-toggle:focus-visible {
      outline: 2px solid var(--pax-color-primary);
      outline-offset: 2px;
    }

    .toggle-chevron {
      transition: transform 150ms ease;
    }

    .toggle-chevron.open {
      transform: rotate(180deg);
    }

    .catalog-only-facts-panel {
      display: grid;
      gap: var(--pax-space-3);
      padding: var(--pax-space-3);
      border-radius: var(--pax-radius-md);
      border: 1px dashed var(--pax-color-outline-variant);
      background: var(--pax-color-surface-container-low);
      min-width: 0;
    }

    .catalog-only-hint,
    .didactic-empty-value {
      margin: 0;
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-xs);
      line-height: var(--pax-lh-xs);
    }

    .evaluated-params-label {
      margin: var(--pax-space-1) 0 0;
    }
  `]
})
export class EvaluatedFactsPanelComponent {
  readonly i18n = inject(PolicyStudioI18n);

  readonly decisionSignal = signal<DecisionSummary | null>(null);
  readonly parametersSignal = signal<readonly RuleParameterDisplayEntry[]>([]);
  readonly viewDepthSignal = signal<StudioViewDepth>('business');
  readonly catalogExpanded = signal(false);

  @Input({ required: true })
  set decision(value: DecisionSummary | null | undefined) {
    const previousKey = this.decisionSignal()?.key ?? null;
    const next = value ?? null;
    this.decisionSignal.set(next);
    if ((next?.key ?? null) !== previousKey) {
      this.catalogExpanded.set(false);
    }
  }

  @Input()
  set parameters(value: readonly RuleParameterDisplayEntry[] | null | undefined) {
    this.parametersSignal.set(value ?? []);
  }

  @Input()
  set viewDepth(value: StudioViewDepth | null | undefined) {
    this.viewDepthSignal.set(value === 'technical' ? 'technical' : 'business');
  }

  readonly partitionedFacts = computed(() => partitionDecisionFacts(this.decisionSignal()));

  readonly evaluatedGroups = computed(() =>
    groupFactsForDisplay(this.partitionedFacts().evaluatedFacts, this.i18n.locale(), this.viewDepthSignal())
  );

  readonly catalogOnlyGroups = computed(() =>
    groupFactsForDisplay(this.partitionedFacts().catalogOnlyFacts, this.i18n.locale(), this.viewDepthSignal())
  );

  shouldShowGroupRows(groups: ReturnType<typeof groupFactsForDisplay>): boolean {
    if (groups.length > 1) return true;
    return groups.length === 1 && groups[0]!.group.key !== 'primary';
  }

  toggleCatalogFacts(): void {
    this.catalogExpanded.update(open => !open);
  }
}
