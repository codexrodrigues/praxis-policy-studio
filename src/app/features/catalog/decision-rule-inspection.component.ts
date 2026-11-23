import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import {
  buildReadableRuleSummary,
  humanizeBaselineAuthority,
  humanizeFactLabel,
  humanizeFactSensitivity,
  humanizeFactValueType,
  humanizeSemanticDiffKind
} from '../../core/decision-rule-presentation';
import { PolicyStudioI18n } from '../../core/i18n';
import type { RuleDocumentationDescriptor } from '../../core/rule-documentation';
import type { RuleParameterDisplayEntry } from '../../core/rule-parameters-display';
import type { SemanticDecisionDiff } from '../../core/semantic-decision-diff';
import type { StudioViewDepth } from '../../core/studio-shell-state.service';
import { StudioIconComponent } from '../../shared/studio-icon.component';
import type { DecisionMaturityPosture } from './catalog-presentation';
import type { DecisionFact, DecisionSummary } from './catalog.fixture';

@Component({
  selector: 'pax-decision-rule-inspection',
  standalone: true,
  imports: [StudioIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let current = decisionSignal();
    @let summary = readableSummary();
    @let posture = maturityPostureSignal();

    @if (current) {
    <header class="rule-inspection-head">
      <div>
        <p class="section-label" id="inspection-title">{{ i18n.text('inspection') }}</p>
        <p class="inspection-summary">{{ i18n.text('inspectionHint') }}</p>
      </div>
      <div class="rule-head-actions">
        @if (canEditRuleSignal()) {
          <button
            type="button"
            class="quiet-button"
            data-testid="rule-edit-draft-btn"
            [disabled]="authoringBusySignal()"
            (click)="editRuleRequested.emit()">
            <pax-icon name="pencil" [size]="14" />
            <span>{{ i18n.text('ruleEditDraftCta') }}</span>
          </button>
        } @else if (canCreateDraftSignal()) {
          <button
            type="button"
            class="quiet-button"
            data-testid="rule-create-draft-btn"
            [disabled]="authoringBusySignal()"
            (click)="createDraftRequested.emit()">
            <pax-icon name="file-edit" [size]="14" />
            <span>{{ i18n.text('ruleCreateDraftCta') }}</span>
          </button>
        }
      </div>
    </header>

    <div class="rule-columns">
      <div class="rule-main-col">
        <section class="rule-surface-card" data-testid="rule-readable-logic" [attr.aria-label]="i18n.text('ruleReadableHeading')">
          <div class="card-head">
            <h2>{{ i18n.text('ruleReadableHeading') }}</h2>
            @if (summary.clauses.length > 1 && summary.lossless) {
              <span class="combinator-pill" data-testid="rule-combinator-pill">
                {{ i18n.text(summary.combinator === 'or' ? 'ruleCombinatorAny' : 'ruleCombinatorAll') }}
              </span>
            }
          </div>

          @if (summary.clauses.length > 0 && summary.lossless) {
            <ul class="clause-list">
              @for (clause of summary.clauses; track clause.factPath + ':' + $index) {
                <li class="clause-card" data-testid="rule-readable-clause">
                  <span class="clause-fact">{{ clause.factLabel }}</span>
                  <span class="clause-operator">{{ clause.operatorLabel }}</span>
                  <span class="clause-value" [class.is-param]="clause.parameterLabel !== null">
                    @if (clause.parameterLabel) {
                      <pax-icon name="sliders" [size]="12" />
                    }
                    <span>{{ clause.valueText }}</span>
                  </span>
                </li>
              }
            </ul>
          } @else {
            <div class="readable-fallback" data-testid="rule-readable-fallback">
              <p class="fallback-summary">{{ documentationSignal()?.summary || current.meaning }}</p>
              <small class="fallback-note">{{ i18n.text('ruleFallbackNotice') }}</small>
            </div>
          }

          @if (viewDepthSignal() !== 'technical') {
            <p class="null-business-note">{{ i18n.text('ruleNullHandlingBusiness') }}</p>
          }

          <details
            class="technical-disclosure"
            data-testid="rule-expression-disclosure"
            [attr.open]="viewDepthSignal() === 'technical' ? '' : null">
            <summary>{{ i18n.text('ruleShowExpressionToggle') }}</summary>
            <div class="disclosure-body">
              @if (current.expression) {
                <code class="expression">{{ current.expression }}</code>
              } @else {
                <p class="inspection-empty">{{ i18n.text('noCondition') }}</p>
              }
              <dl class="contract-facts">
                <div>
                  <dt>{{ i18n.text('missingDataBehavior') }}</dt>
                  <dd>{{ nullSemanticsTextSignal() }}</dd>
                </div>
                @if (viewDepthSignal() === 'technical') {
                  <div>
                    <dt>{{ i18n.text('nullBehavior') }}</dt>
                    <dd><code class="studio-mono">{{ current.nullSemantics ?? '—' }}</code></dd>
                  </div>
                  <div>
                    <dt>{{ i18n.text('operations') }}</dt>
                    <dd><code class="studio-mono">{{ current.operationKeys.join(' · ') || '—' }}</code></dd>
                  </div>
                  <div>
                    <dt>{{ i18n.text('hostContract') }}</dt>
                    <dd><code class="studio-mono">{{ current.hostContractVersion ?? '—' }}</code></dd>
                  </div>
                }
              </dl>
            </div>
          </details>
        </section>

        @if (parametersSignal().length > 0) {
          <section class="rule-surface-card" data-testid="rule-active-parameters">
            <div class="card-head">
              <h2>{{ i18n.text('ruleActiveParametersTitle') }}</h2>
              <small class="card-hint">{{ i18n.text('ruleActiveParametersHint') }}</small>
            </div>
            <dl class="param-grid">
              @for (param of parametersSignal(); track param.key) {
                <div class="param-tile" [class.is-customized]="param.isCustomized">
                  <dt>{{ param.label }}</dt>
                  <dd>
                    <strong class="studio-mono">{{ param.valueText }}</strong>
                    @if (param.defaultHint) {
                      <small>{{ param.defaultHint }}</small>
                    }
                  </dd>
                </div>
              }
            </dl>
          </section>
        }
      </div>

      <div class="rule-facts-col">
        <section class="rule-surface-card" [attr.aria-label]="i18n.text('ruleEvaluatedFactsTitle')">
          <div class="card-head">
            <h2>{{ i18n.text('ruleEvaluatedFactsTitle') }}</h2>
          </div>

          @if (posture && posture.totalFacts > 0) {
            <small class="authority-note" data-testid="fact-redaction-summary">
              {{ i18n.text('factRedactionSummaryTitle') }}:
              {{ posture.sensitiveFactsCount }}/{{ posture.totalFacts }} {{ i18n.text('factSensitiveCount') }} ·
              {{ posture.redactedFactsCount }}/{{ posture.totalFacts }} {{ i18n.text('factRedactedCount') }}
            </small>
            @if (posture.sensitiveFactsCount > 0 || posture.redactedFactsCount > 0) {
              <button
                type="button"
                class="privacy-bridge-btn"
                data-testid="rule-privacy-bridge-btn"
                (click)="openAccessPrivacyRequested.emit()">
                <pax-icon name="shield-alert" [size]="14" />
                <span>{{ i18n.text('rulePrivacyBridgeLabel') }}</span>
                <pax-icon name="arrow-right" [size]="14" />
              </button>
            }
          }

          <ul class="fact-list fact-cards">
            @for (fact of current.facts; track fact.path) {
              @let sensitivity = factSensitivity(fact);
              <li class="fact-card">
                <div class="fact-card-head">
                  <strong>{{ factDisplayLabel(fact) }}</strong>
                  <span class="sensitivity-pill" [attr.data-tone]="sensitivity.tone">
                    {{ sensitivity.label }}
                  </span>
                </div>
                @if (fact.description) {
                  <p class="fact-desc">{{ fact.description }}</p>
                }
                <div class="fact-meta">
                  <span>{{ factTypeLabel(fact) }}</span>
                  <span>·</span>
                  <span>{{ i18n.text(fact.nullable ? 'factNullable' : 'factRequired') }}</span>
                </div>
                @if (viewDepthSignal() === 'technical') {
                  <div class="fact-tech-meta studio-mono">
                    <code>{{ fact.path }}</code>
                    <span>{{ fact.sensitivity }} / {{ fact.redaction }}</span>
                  </div>
                }
              </li>
            } @empty {
              <li class="inspection-empty fact-gap">{{ i18n.text('factCatalogUnavailable') }}</li>
            }
          </ul>
        </section>
      </div>
    </div>

    <div class="version-compare-card" [attr.aria-label]="i18n.text('authorityDraftComparison')">
      <section class="compare-side">
        <span class="version-kicker">{{ i18n.text('baseline') }}</span>
        <strong>{{ i18n.text('referenceBaseline') }}</strong>
        <small>{{ baselineAuthorityText() }}</small>
      </section>
      <pax-icon class="compare-arrow" name="arrow-right" [size]="18" />
      <section class="compare-side" [class.unavailable]="!current.configStatus">
        <span class="version-kicker">{{ i18n.text('draft') }}</span>
        <strong>{{ current.configStatus ? configStatusTextSignal() : i18n.text('noDraft') }}</strong>
        <small>{{ i18n.text('governedDraftReviewHint') }}</small>
      </section>
    </div>

    @if (current.workspaceId) {
      <section class="semantic-diff-card" aria-labelledby="semantic-diff-title">
        <header>
          <div>
            <p class="section-label" id="semantic-diff-title">{{ i18n.text('semanticDiff') }}</p>
            <p class="diff-boundary">{{ i18n.text('semanticDiffBoundary') }}</p>
          </div>
          <strong class="diff-count studio-mono">{{ semanticDiffSignal().length }}</strong>
        </header>
        @for (change of semanticDiffSignal(); track change.path + change.kind) {
          <article class="diff-row">
            <span class="diff-kind">{{ diffKindLabel(change.kind) }}</span>
            <code class="studio-mono">{{ change.path }}</code>
            <small>{{ displayDiffValue(change.baseline) }} → {{ displayDiffValue(change.candidate) }}</small>
          </article>
        } @empty {
          <p class="diff-empty">{{ i18n.text('noSemanticChanges') }}</p>
        }
      </section>
    }
    }
  `,
  styles: [`
    :host {
      display: grid;
      gap: var(--pax-space-5);
      min-width: 0;
    }

    .rule-inspection-head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--pax-space-3) var(--pax-space-4);
    }

    .section-label,
    .version-kicker {
      margin: 0;
      color: var(--pax-color-primary);
      font-size: var(--pax-text-xs);
      line-height: var(--pax-lh-xs);
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .version-kicker {
      color: var(--pax-color-on-surface-variant);
    }

    .inspection-summary {
      margin: var(--pax-space-1) 0 0;
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-sm);
      line-height: var(--pax-lh-sm);
    }

    .rule-head-actions button {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
    }

    .rule-columns {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(16rem, 0.85fr);
      gap: var(--pax-space-4);
      align-items: start;
      min-width: 0;
    }

    .rule-main-col,
    .rule-facts-col {
      display: grid;
      gap: var(--pax-space-4);
      min-width: 0;
    }

    .rule-surface-card {
      display: grid;
      gap: var(--pax-space-3);
      padding: var(--pax-space-4);
      border: 1px solid var(--pax-color-outline-variant);
      border-radius: var(--pax-radius-lg);
      background: var(--pax-color-surface-container-low);
      min-width: 0;
    }

    .card-head {
      display: grid;
      gap: var(--pax-space-1);
    }

    .card-head h2 {
      margin: 0;
      font-family: var(--pax-font-display);
      font-size: var(--pax-text-base);
      line-height: 1.35;
      font-weight: 700;
    }

    .card-hint,
    .fallback-note,
    .null-business-note {
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-xs);
      line-height: var(--pax-lh-xs);
      margin: 0;
    }

    .combinator-pill {
      justify-self: start;
      padding: 0.125rem var(--pax-space-2);
      border-radius: var(--pax-radius-pill);
      background: var(--pax-color-primary-container);
      color: var(--pax-color-on-primary-container);
      font-size: var(--pax-text-xs);
      font-weight: 700;
    }

    .clause-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--pax-space-2);
    }

    .clause-card {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--pax-space-2);
      padding: var(--pax-space-3);
      border-radius: var(--pax-radius-md);
      border: 1px solid var(--pax-color-outline-variant);
      background: var(--pax-color-surface);
      font-size: var(--pax-text-sm);
      line-height: var(--pax-lh-sm);
    }

    .clause-fact {
      font-weight: 700;
      color: var(--pax-color-on-surface);
    }

    .clause-operator {
      color: var(--pax-color-on-surface-variant);
    }

    .clause-value {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.125rem var(--pax-space-2);
      border-radius: var(--pax-radius-sm);
      background: var(--pax-color-surface-container);
      color: var(--pax-color-on-surface);
      font-weight: 700;
    }

    .clause-value.is-param {
      background: var(--pax-policy-param-bg);
      color: var(--pax-policy-param-fg);
    }

    .readable-fallback {
      display: grid;
      gap: var(--pax-space-2);
      padding: var(--pax-space-3);
      border-radius: var(--pax-radius-md);
      background: var(--pax-color-surface);
      border: 1px solid var(--pax-color-outline-variant);
    }

    .fallback-summary {
      margin: 0;
      font-size: var(--pax-text-sm);
      line-height: var(--pax-lh-sm);
      font-weight: 500;
    }

    .technical-disclosure {
      border-top: 1px solid var(--pax-color-outline-variant);
      padding-top: var(--pax-space-3);
    }

    .technical-disclosure summary {
      cursor: pointer;
      color: var(--pax-color-primary);
      font-size: var(--pax-text-xs);
      font-weight: 700;
    }

    .disclosure-body {
      display: grid;
      gap: var(--pax-space-3);
      margin-top: var(--pax-space-3);
    }

    .expression {
      display: block;
      padding: var(--pax-space-3);
      border-inline-start: 3px solid var(--pax-color-primary);
      border-radius: var(--pax-radius-sm);
      background: var(--pax-color-surface);
      color: var(--pax-color-on-surface);
      font-size: var(--pax-text-xs);
      line-height: 1.5;
      overflow-wrap: anywhere;
    }

    .contract-facts {
      display: grid;
      gap: var(--pax-space-2);
      margin: 0;
    }

    .contract-facts dt {
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-xs);
      font-weight: 700;
    }

    .contract-facts dd {
      margin: 0.125rem 0 0;
      font-size: var(--pax-text-xs);
      overflow-wrap: anywhere;
    }

    .param-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
      gap: var(--pax-space-2);
      margin: 0;
    }

    .param-tile {
      padding: var(--pax-space-3);
      border-radius: var(--pax-radius-md);
      border: 1px solid var(--pax-color-outline-variant);
      background: var(--pax-color-surface);
      display: grid;
      gap: 0.25rem;
    }

    .param-tile.is-customized {
      border-color: var(--pax-color-warning);
      background: color-mix(in oklab, var(--pax-color-warning-container) 35%, var(--pax-color-surface));
    }

    .param-tile dt {
      font-size: var(--pax-text-xs);
      color: var(--pax-color-on-surface-variant);
      font-weight: 600;
    }

    .param-tile dd {
      margin: 0;
      display: grid;
      gap: 0.125rem;
    }

    .param-tile strong {
      font-size: var(--pax-text-sm);
    }

    .param-tile small {
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-xs);
    }

    .authority-note {
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-xs);
      line-height: var(--pax-lh-xs);
    }

    .privacy-bridge-btn {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--pax-space-2);
      width: 100%;
      border: 1px solid color-mix(in oklab, var(--pax-color-warning) 55%, var(--pax-color-outline-variant));
      border-radius: var(--pax-radius-md);
      padding: var(--pax-space-2) var(--pax-space-3);
      background: color-mix(in oklab, var(--pax-color-warning-container) 45%, var(--pax-color-surface));
      color: var(--pax-color-on-surface);
      font-size: var(--pax-text-xs);
      line-height: var(--pax-lh-xs);
      font-weight: 700;
      text-align: left;
      cursor: pointer;
    }

    .privacy-bridge-btn:hover {
      border-color: var(--pax-color-primary);
      background: var(--pax-color-primary-container);
      color: var(--pax-color-on-primary-container);
    }

    .privacy-bridge-btn:focus-visible {
      outline: 2px solid var(--pax-color-primary);
      outline-offset: 2px;
    }

    .fact-cards {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--pax-space-2);
    }

    .fact-card {
      display: grid;
      gap: 0.25rem;
      padding: var(--pax-space-3);
      border-radius: var(--pax-radius-md);
      border: 1px solid var(--pax-color-outline-variant);
      background: var(--pax-color-surface);
    }

    .fact-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--pax-space-2);
    }

    .fact-card-head strong {
      font-size: var(--pax-text-sm);
      overflow-wrap: anywhere;
    }

    .sensitivity-pill {
      flex-shrink: 0;
      padding: 0.0625rem var(--pax-space-2);
      border-radius: var(--pax-radius-pill);
      font-size: var(--pax-text-xs);
      font-weight: 700;
      background: var(--pax-color-surface-container);
      color: var(--pax-color-on-surface-variant);
    }

    .sensitivity-pill[data-tone='info'] {
      background: var(--pax-policy-param-bg);
      color: var(--pax-policy-param-fg);
    }

    .sensitivity-pill[data-tone='warning'] {
      background: var(--pax-color-warning-container);
      color: var(--pax-color-on-warning-container);
    }

    .sensitivity-pill[data-tone='danger'] {
      background: var(--pax-color-error-container);
      color: var(--pax-color-on-error-container);
    }

    .fact-desc {
      margin: 0;
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-xs);
      line-height: var(--pax-lh-xs);
    }

    .fact-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-xs);
      font-weight: 600;
    }

    .fact-tech-meta {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 0.25rem 0.5rem;
      padding-top: 0.25rem;
      border-top: 1px dashed var(--pax-color-outline-variant);
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-xs);
      overflow-wrap: anywhere;
    }

    .inspection-empty {
      margin: 0;
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-sm);
    }

    .fact-gap {
      padding: var(--pax-space-3);
      border-radius: var(--pax-radius-md);
      background: var(--pax-color-error-container);
      color: var(--pax-color-on-error-container);
    }

    .version-compare-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      align-items: center;
      gap: var(--pax-space-3);
      padding: var(--pax-space-4);
      border: 1px solid var(--pax-color-outline-variant);
      border-radius: var(--pax-radius-lg);
      background: var(--pax-color-surface-container-low);
    }

    .compare-side {
      display: grid;
      gap: 0.25rem;
      min-width: 0;
    }

    .compare-side.unavailable {
      opacity: 0.72;
    }

    .compare-side strong {
      font-size: var(--pax-text-sm);
    }

    .compare-side small {
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-xs);
    }

    .compare-arrow {
      color: var(--pax-color-primary);
    }

    .semantic-diff-card {
      display: grid;
      gap: var(--pax-space-3);
      padding: var(--pax-space-4);
      border: 1px solid var(--pax-color-outline-variant);
      border-radius: var(--pax-radius-lg);
      background: var(--pax-color-surface-container-low);
    }

    .semantic-diff-card header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--pax-space-3);
    }

    .diff-boundary,
    .diff-empty {
      margin: var(--pax-space-1) 0 0;
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-xs);
    }

    .diff-count {
      padding: 0.125rem var(--pax-space-2);
      border-radius: var(--pax-radius-pill);
      background: var(--pax-color-surface-container);
      font-size: var(--pax-text-xs);
    }

    .diff-row {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: var(--pax-space-2);
      align-items: baseline;
      padding: var(--pax-space-2) var(--pax-space-3);
      border-radius: var(--pax-radius-md);
      background: var(--pax-color-surface);
      border: 1px solid var(--pax-color-outline-variant);
      font-size: var(--pax-text-xs);
    }

    .diff-kind {
      font-weight: 700;
      color: var(--pax-color-primary);
    }

    @media (max-width: 860px) {
      .rule-columns {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 760px) {
      .version-compare-card {
        grid-template-columns: 1fr;
      }
      .compare-arrow {
        transform: rotate(90deg);
        justify-self: start;
      }
      .diff-row {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class DecisionRuleInspectionComponent {
  readonly i18n = inject(PolicyStudioI18n);

  readonly decisionSignal = signal<DecisionSummary | null>(null);
  readonly viewDepthSignal = signal<StudioViewDepth>('business');
  readonly maturityPostureSignal = signal<DecisionMaturityPosture | null>(null);
  readonly parametersSignal = signal<readonly RuleParameterDisplayEntry[]>([]);
  readonly documentationSignal = signal<RuleDocumentationDescriptor | null>(null);
  readonly semanticDiffSignal = signal<readonly SemanticDecisionDiff[]>([]);
  readonly canEditRuleSignal = signal(false);
  readonly canCreateDraftSignal = signal(false);
  readonly authoringBusySignal = signal(false);
  readonly nullSemanticsTextSignal = signal('');
  readonly configStatusTextSignal = signal('');

  @Input({ required: true })
  set decision(value: DecisionSummary | null | undefined) {
    this.decisionSignal.set(value ?? null);
  }

  @Input()
  set viewDepth(value: StudioViewDepth | undefined) {
    this.viewDepthSignal.set(value ?? 'business');
  }

  @Input()
  set maturityPosture(value: DecisionMaturityPosture | null | undefined) {
    this.maturityPostureSignal.set(value ?? null);
  }

  @Input()
  set parameters(value: readonly RuleParameterDisplayEntry[] | undefined) {
    this.parametersSignal.set(value ?? []);
  }

  @Input()
  set documentation(value: RuleDocumentationDescriptor | null | undefined) {
    this.documentationSignal.set(value ?? null);
  }

  @Input()
  set semanticDiff(value: readonly SemanticDecisionDiff[] | undefined) {
    this.semanticDiffSignal.set(value ?? []);
  }

  @Input()
  set canEditRule(value: boolean | undefined) {
    this.canEditRuleSignal.set(Boolean(value));
  }

  @Input()
  set canCreateDraft(value: boolean | undefined) {
    this.canCreateDraftSignal.set(Boolean(value));
  }

  @Input()
  set authoringBusy(value: boolean | undefined) {
    this.authoringBusySignal.set(Boolean(value));
  }

  @Input()
  set nullSemanticsText(value: string | undefined) {
    this.nullSemanticsTextSignal.set(value ?? '');
  }

  @Input()
  set configStatusText(value: string | undefined) {
    this.configStatusTextSignal.set(value ?? '');
  }

  @Output() readonly editRuleRequested = new EventEmitter<void>();
  @Output() readonly createDraftRequested = new EventEmitter<void>();
  @Output() readonly openAccessPrivacyRequested = new EventEmitter<void>();

  readonly readableSummary = computed(() => {
    const current = this.decisionSignal();
    if (!current) {
      return { combinator: 'and' as const, clauses: [], lossless: true };
    }
    return buildReadableRuleSummary(
      current,
      this.parametersSignal(),
      this.i18n.locale(),
      this.viewDepthSignal()
    );
  });

  factDisplayLabel(fact: DecisionFact): string {
    return humanizeFactLabel(fact, this.i18n.locale(), this.viewDepthSignal());
  }

  factTypeLabel(fact: DecisionFact): string {
    return this.viewDepthSignal() === 'technical'
      ? fact.valueType
      : humanizeFactValueType(fact.valueType, this.i18n.locale());
  }

  factSensitivity(fact: DecisionFact) {
    return humanizeFactSensitivity(fact.sensitivity, this.i18n.locale());
  }

  baselineAuthorityText(): string {
    return humanizeBaselineAuthority(
      this.decisionSignal()?.baselineAuthority,
      this.i18n.locale(),
      this.viewDepthSignal()
    );
  }

  diffKindLabel(kind: string): string {
    return humanizeSemanticDiffKind(kind, this.i18n.locale());
  }

  displayDiffValue(value: unknown): string {
    return value === undefined ? '—' : JSON.stringify(value);
  }
}
