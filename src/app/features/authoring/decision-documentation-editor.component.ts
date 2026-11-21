import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, effect, inject, signal } from '@angular/core';
import { PolicyStudioI18n } from '../../core/i18n';
import {
  isSafeLegalBasisUrl,
  normalizeAndCompactDocumentation,
  RULE_DOCUMENTATION_LIMITS,
  validateRuleDocumentationDetailed,
  type RuleDocumentationDescriptor,
  type RuleDocumentationValidationMessages,
  type RuleLegalBasisDescriptor,
  type RuleLegalBasisEntryValidation
} from '../../core/rule-documentation';

interface DraftLegalBasisRow {
  readonly code: string;
  readonly title: string;
  readonly article: string;
  readonly jurisdiction: string;
  readonly summary: string;
  readonly url: string;
}

interface DraftDocumentationState {
  readonly title: string;
  readonly summary: string;
  readonly whenApplies: string;
  readonly rationale: string;
  readonly customizationGuidance: string;
  readonly legalBasis: readonly DraftLegalBasisRow[];
}

const EMPTY_DRAFT_STATE: DraftDocumentationState = {
  title: '',
  summary: '',
  whenApplies: '',
  rationale: '',
  customizationGuidance: '',
  legalBasis: []
};

function toDraftState(doc: RuleDocumentationDescriptor | null | undefined): DraftDocumentationState {
  if (!doc) return EMPTY_DRAFT_STATE;
  return {
    title: doc.title ?? '',
    summary: doc.summary ?? '',
    whenApplies: doc.whenApplies ?? '',
    rationale: doc.rationale ?? '',
    customizationGuidance: doc.customizationGuidance ?? '',
    legalBasis: (doc.legalBasis ?? []).map(entry => ({
      code: entry.code ?? '',
      title: entry.title ?? '',
      article: entry.article ?? '',
      jurisdiction: entry.jurisdiction ?? '',
      summary: entry.summary ?? '',
      url: entry.url ?? ''
    }))
  };
}

function toDescriptor(state: DraftDocumentationState): RuleDocumentationDescriptor {
  return {
    title: state.title,
    summary: state.summary,
    whenApplies: state.whenApplies,
    rationale: state.rationale,
    customizationGuidance: state.customizationGuidance,
    legalBasis: state.legalBasis.map(row => ({
      code: row.code,
      title: row.title,
      article: row.article,
      jurisdiction: row.jurisdiction,
      summary: row.summary,
      url: row.url
    })) as RuleLegalBasisDescriptor[]
  };
}

@Component({
  selector: 'pax-decision-documentation-editor',
  template: `
    <div
      class="doc-editor"
      role="group"
      [attr.data-testid]="idPrefix() + '-editor'"
      [attr.aria-labelledby]="idPrefix() + '-doc-heading'">
      <div class="doc-header">
        <div class="doc-heading-copy">
          <p class="doc-section-title" [id]="idPrefix() + '-doc-heading'">{{ i18n.text('didacticDocumentationSection') }}</p>
          <p class="doc-hint">{{ i18n.text('didacticDocumentationHint') }}</p>
        </div>
        @if (collapsedByDefault()) {
          <button
            type="button"
            class="doc-toggle"
            [attr.data-testid]="idPrefix() + '-toggle'"
            [attr.aria-expanded]="expanded()"
            [disabled]="disabled()"
            (click)="toggleExpanded()">
            {{ i18n.text('didacticCreateToggle') }}
            @if (validationResult().errors.length > 0) {
              <span class="doc-error-count">({{ validationResult().errors.length }})</span>
            }
          </button>
        }
      </div>

      @if (expanded()) {
        <div class="doc-fields" [attr.data-testid]="idPrefix() + '-fields'">
          <div class="doc-field">
            <label [for]="idPrefix() + '-title'">{{ i18n.text('didacticTitleLabel') }}</label>
            <input
              [id]="idPrefix() + '-title'"
              [attr.data-testid]="idPrefix() + '-title'"
              type="text"
              [disabled]="disabled()"
              [value]="draft().title"
              [placeholder]="i18n.text('didacticTitlePlaceholder')"
              (input)="updateTextField('title', $any($event.target).value)" />
            @if (validationResult().fieldErrors.title; as err) {
              <small class="doc-error" role="alert" [attr.data-testid]="idPrefix() + '-title-error'">{{ err }}</small>
            }
          </div>

          <div class="doc-field">
            <label [for]="idPrefix() + '-summary'">{{ i18n.text('didacticSummaryLabel') }}</label>
            <textarea
              [id]="idPrefix() + '-summary'"
              [attr.data-testid]="idPrefix() + '-summary'"
              rows="2"
              [disabled]="disabled()"
              [value]="draft().summary"
              [placeholder]="i18n.text('didacticSummaryPlaceholder')"
              (input)="updateTextField('summary', $any($event.target).value)"></textarea>
            @if (validationResult().fieldErrors.summary; as err) {
              <small class="doc-error" role="alert" [attr.data-testid]="idPrefix() + '-summary-error'">{{ err }}</small>
            }
          </div>

          <div class="doc-grid-two">
            <div class="doc-field">
              <label [for]="idPrefix() + '-when-applies'">{{ i18n.text('didacticWhenAppliesLabel') }}</label>
              <textarea
                [id]="idPrefix() + '-when-applies'"
                [attr.data-testid]="idPrefix() + '-when-applies'"
                rows="2"
                [disabled]="disabled()"
                [value]="draft().whenApplies"
                [placeholder]="i18n.text('didacticWhenAppliesPlaceholder')"
                (input)="updateTextField('whenApplies', $any($event.target).value)"></textarea>
              @if (validationResult().fieldErrors.whenApplies; as err) {
                <small class="doc-error" role="alert" [attr.data-testid]="idPrefix() + '-when-applies-error'">{{ err }}</small>
              }
            </div>

            <div class="doc-field">
              <label [for]="idPrefix() + '-rationale'">{{ i18n.text('didacticRationaleLabel') }}</label>
              <textarea
                [id]="idPrefix() + '-rationale'"
                [attr.data-testid]="idPrefix() + '-rationale'"
                rows="2"
                [disabled]="disabled()"
                [value]="draft().rationale"
                [placeholder]="i18n.text('didacticRationalePlaceholder')"
                (input)="updateTextField('rationale', $any($event.target).value)"></textarea>
              @if (validationResult().fieldErrors.rationale; as err) {
                <small class="doc-error" role="alert" [attr.data-testid]="idPrefix() + '-rationale-error'">{{ err }}</small>
              }
            </div>
          </div>

          <div class="doc-field">
            <label [for]="idPrefix() + '-customization-guidance'">{{ i18n.text('didacticCustomizationGuidanceLabel') }}</label>
            <textarea
              [id]="idPrefix() + '-customization-guidance'"
              [attr.data-testid]="idPrefix() + '-customization-guidance'"
              rows="2"
              [disabled]="disabled()"
              [value]="draft().customizationGuidance"
              [placeholder]="i18n.text('didacticCustomizationGuidancePlaceholder')"
              (input)="updateTextField('customizationGuidance', $any($event.target).value)"></textarea>
            @if (validationResult().fieldErrors.customizationGuidance; as err) {
              <small class="doc-error" role="alert" [attr.data-testid]="idPrefix() + '-customization-guidance-error'">{{ err }}</small>
            }
          </div>

          <div class="legal-basis-section" [attr.data-testid]="idPrefix() + '-legal-section'">
            <div class="legal-basis-header">
              <div>
                <p class="doc-subsection-title">{{ i18n.text('legalBasisSectionTitle') }}</p>
                <small class="doc-hint">
                  {{ i18n.format('legalBasisLimitHint', { count: draft().legalBasis.length, max: maxLegalBasisEntries }) }}
                </small>
              </div>
              <button
                type="button"
                class="doc-secondary-btn"
                [attr.data-testid]="idPrefix() + '-legal-add'"
                [disabled]="disabled() || draft().legalBasis.length >= maxLegalBasisEntries"
                (click)="addLegalBasis()">
                {{ i18n.text('legalBasisAdd') }}
              </button>
            </div>

            @if (validationResult().fieldErrors.legalBasis; as err) {
              <small class="doc-error" role="alert" [attr.data-testid]="idPrefix() + '-legal-max-error'">{{ err }}</small>
            }

            @for (row of draft().legalBasis; track $index) {
              @let rowErrors = entryValidationFor($index);
              <fieldset class="legal-basis-row" [attr.data-testid]="idPrefix() + '-legal-row-' + $index">
                <legend>
                  <span>{{ i18n.format('legalBasisEntryLabel', { index: $index + 1 }) }}</span>
                  <button
                    type="button"
                    class="doc-remove-btn"
                    [attr.data-testid]="idPrefix() + '-legal-remove-' + $index"
                    [disabled]="disabled()"
                    (click)="removeLegalBasis($index)">
                    {{ i18n.text('legalBasisRemove') }}
                  </button>
                </legend>

                @if (rowErrors?.identityError; as err) {
                  <small class="doc-error" role="alert" [attr.data-testid]="idPrefix() + '-legal-identity-error-' + $index">{{ err }}</small>
                }

                <div class="doc-grid-two">
                  <div class="doc-field">
                    <label [for]="idPrefix() + '-legal-' + $index + '-code'">{{ i18n.text('legalBasisCodeLabel') }}</label>
                    <input
                      [id]="idPrefix() + '-legal-' + $index + '-code'"
                      [attr.data-testid]="idPrefix() + '-legal-code-' + $index"
                      type="text"
                      [disabled]="disabled()"
                      [value]="row.code"
                      [placeholder]="i18n.text('legalBasisCodePlaceholder')"
                      (input)="updateLegalBasisField($index, 'code', $any($event.target).value)" />
                    @if (rowErrors?.codeError; as err) {
                      <small class="doc-error" role="alert">{{ err }}</small>
                    }
                  </div>

                  <div class="doc-field">
                    <label [for]="idPrefix() + '-legal-' + $index + '-title'">{{ i18n.text('legalBasisTitleLabel') }}</label>
                    <input
                      [id]="idPrefix() + '-legal-' + $index + '-title'"
                      [attr.data-testid]="idPrefix() + '-legal-title-' + $index"
                      type="text"
                      [disabled]="disabled()"
                      [value]="row.title"
                      [placeholder]="i18n.text('legalBasisTitlePlaceholder')"
                      (input)="updateLegalBasisField($index, 'title', $any($event.target).value)" />
                    @if (rowErrors?.titleError; as err) {
                      <small class="doc-error" role="alert">{{ err }}</small>
                    }
                  </div>

                  <div class="doc-field">
                    <label [for]="idPrefix() + '-legal-' + $index + '-article'">{{ i18n.text('legalBasisArticleLabel') }}</label>
                    <input
                      [id]="idPrefix() + '-legal-' + $index + '-article'"
                      [attr.data-testid]="idPrefix() + '-legal-article-' + $index"
                      type="text"
                      [disabled]="disabled()"
                      [value]="row.article"
                      [placeholder]="i18n.text('legalBasisArticlePlaceholder')"
                      (input)="updateLegalBasisField($index, 'article', $any($event.target).value)" />
                    @if (rowErrors?.articleError; as err) {
                      <small class="doc-error" role="alert">{{ err }}</small>
                    }
                  </div>

                  <div class="doc-field">
                    <label [for]="idPrefix() + '-legal-' + $index + '-jurisdiction'">{{ i18n.text('legalBasisJurisdictionLabel') }}</label>
                    <input
                      [id]="idPrefix() + '-legal-' + $index + '-jurisdiction'"
                      [attr.data-testid]="idPrefix() + '-legal-jurisdiction-' + $index"
                      type="text"
                      [disabled]="disabled()"
                      [value]="row.jurisdiction"
                      [placeholder]="i18n.text('legalBasisJurisdictionPlaceholder')"
                      (input)="updateLegalBasisField($index, 'jurisdiction', $any($event.target).value)" />
                    @if (rowErrors?.jurisdictionError; as err) {
                      <small class="doc-error" role="alert">{{ err }}</small>
                    }
                  </div>
                </div>

                <div class="doc-field">
                  <label [for]="idPrefix() + '-legal-' + $index + '-summary'">{{ i18n.text('legalBasisSummaryLabel') }}</label>
                  <textarea
                    [id]="idPrefix() + '-legal-' + $index + '-summary'"
                    [attr.data-testid]="idPrefix() + '-legal-summary-' + $index"
                    rows="2"
                    [disabled]="disabled()"
                    [value]="row.summary"
                    [placeholder]="i18n.text('legalBasisSummaryPlaceholder')"
                    (input)="updateLegalBasisField($index, 'summary', $any($event.target).value)"></textarea>
                  @if (rowErrors?.summaryError; as err) {
                    <small class="doc-error" role="alert">{{ err }}</small>
                  }
                </div>

                <div class="doc-field">
                  <label [for]="idPrefix() + '-legal-' + $index + '-url'">{{ i18n.text('legalBasisUrlLabel') }}</label>
                  <div class="url-input-row">
                    <input
                      [id]="idPrefix() + '-legal-' + $index + '-url'"
                      [attr.data-testid]="idPrefix() + '-legal-url-' + $index"
                      type="url"
                      [disabled]="disabled()"
                      [value]="row.url"
                      [placeholder]="i18n.text('legalBasisUrlPlaceholder')"
                      (input)="updateLegalBasisField($index, 'url', $any($event.target).value)" />
                    @if (isSafeUrl(row.url)) {
                      <a
                        class="doc-url-link"
                        [href]="row.url.trim()"
                        target="_blank"
                        rel="noopener noreferrer">
                        {{ i18n.text('legalBasisOpenLink') }}
                      </a>
                    }
                  </div>
                  @if (rowErrors?.urlError; as err) {
                    <small class="doc-error" role="alert" [attr.data-testid]="idPrefix() + '-legal-url-error-' + $index">{{ err }}</small>
                  }
                </div>
              </fieldset>
            } @empty {
              <p class="doc-empty">{{ i18n.text('legalBasisEmpty') }}</p>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-width: 0;
    }
    .doc-editor {
      display: grid;
      gap: 0.85rem;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--pax-color-outline-variant, #c5d0d5);
      min-width: 0;
    }
    .doc-header,
    .legal-basis-header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.65rem;
    }
    .doc-heading-copy {
      min-width: 0;
      flex: 1 1 14rem;
    }
    .doc-section-title,
    .doc-subsection-title {
      margin: 0;
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--pax-color-on-surface, #15242a);
    }
    .doc-hint,
    .doc-empty {
      margin: 0.2rem 0 0;
      font-size: 0.78rem;
      color: var(--pax-color-on-surface-variant, #52636a);
      line-height: 1.4;
    }
    .doc-fields,
    .legal-basis-section {
      display: grid;
      gap: 0.75rem;
      min-width: 0;
    }
    .doc-grid-two {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
      min-width: 0;
    }
    .doc-field {
      display: grid;
      gap: 0.3rem;
      min-width: 0;
    }
    .doc-field label {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--pax-color-on-surface-variant, #52636a);
    }
    .doc-field input,
    .doc-field textarea {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      border: 1px solid var(--pax-color-outline, #697a82);
      border-radius: 0.35rem;
      background: var(--pax-color-surface, #fff);
      color: var(--pax-color-on-surface, #15242a);
      padding: 0.5rem 0.65rem;
      font: inherit;
      font-size: 0.88rem;
      resize: vertical;
    }
    .doc-field input:focus-visible,
    .doc-field textarea:focus-visible,
    .doc-toggle:focus-visible,
    .doc-secondary-btn:focus-visible,
    .doc-remove-btn:focus-visible {
      outline: 3px solid color-mix(in srgb, var(--pax-color-primary, #076487) 35%, transparent);
      outline-offset: 2px;
      border-color: var(--pax-color-primary, #076487);
    }
    .doc-toggle,
    .doc-secondary-btn,
    .doc-remove-btn {
      border: 1px solid var(--pax-color-outline, #697a82);
      border-radius: 0.45rem;
      background: var(--pax-color-surface-container-lowest, #fff);
      color: var(--pax-color-on-surface, #15242a);
      padding: 0.42rem 0.72rem;
      font: inherit;
      font-size: 0.8rem;
      font-weight: 650;
      cursor: pointer;
    }
    .doc-toggle:disabled,
    .doc-secondary-btn:disabled,
    .doc-remove-btn:disabled {
      cursor: not-allowed;
      opacity: 0.58;
    }
    .doc-error-count {
      color: var(--pax-color-error, #ba1a1a);
      font-weight: 750;
    }
    .legal-basis-row {
      margin: 0;
      padding: 0.75rem;
      border: 1px solid var(--pax-color-outline-variant, #c5d0d5);
      border-radius: 0.5rem;
      background: var(--pax-color-surface-container-low, #f1f5f6);
      display: grid;
      gap: 0.65rem;
      min-width: 0;
      min-inline-size: 0;
      width: 100%;
    }
    .legal-basis-row legend {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding-inline: 0.35rem;
      font-size: 0.78rem;
      font-weight: 750;
      color: var(--pax-color-primary, #076487);
    }
    .url-input-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
    }
    .url-input-row input {
      flex: 1 1 12rem;
    }
    .doc-url-link {
      font-size: 0.8rem;
      font-weight: 650;
      color: var(--pax-color-primary, #076487);
      white-space: nowrap;
    }
    .doc-error {
      color: var(--pax-color-error, #ba1a1a);
      font-size: 0.78rem;
      font-weight: 600;
      line-height: 1.35;
    }
    @media (max-width: 48rem) {
      .doc-grid-two {
        grid-template-columns: 1fr;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DecisionDocumentationEditorComponent {
  protected readonly i18n = inject(PolicyStudioI18n);
  protected readonly maxLegalBasisEntries = RULE_DOCUMENTATION_LIMITS.legalBasisMaxEntries;

  readonly documentationSignal = signal<RuleDocumentationDescriptor | null>(null);
  readonly idPrefix = signal('draft-doc');
  readonly disabled = signal(false);
  readonly collapsedByDefault = signal(false);

  @Input()
  set documentation(value: RuleDocumentationDescriptor | null | undefined) {
    this.documentationSignal.set(value ?? null);
  }

  @Input('idPrefix')
  set idPrefixInput(value: string | null | undefined) {
    this.idPrefix.set(value?.trim() || 'draft-doc');
  }

  @Input('disabled')
  set disabledInput(value: boolean | null | undefined) {
    this.disabled.set(Boolean(value));
  }

  @Input('collapsedByDefault')
  set collapsedByDefaultInput(value: boolean | null | undefined) {
    this.collapsedByDefault.set(Boolean(value));
  }

  @Output() readonly documentationChanged = new EventEmitter<RuleDocumentationDescriptor | null>();
  @Output() readonly validationErrorsChanged = new EventEmitter<readonly string[]>();

  protected readonly draft = signal<DraftDocumentationState>(EMPTY_DRAFT_STATE);
  private readonly userExpanded = signal<boolean | null>(null);
  protected readonly expanded = computed(() => {
    const manual = this.userExpanded();
    return manual !== null ? manual : !this.collapsedByDefault();
  });

  private lastEmittedCanonical: string | null = null;

  protected readonly validationMessages = computed<RuleDocumentationValidationMessages>(() => {
    // Subscribe to locale so error copy refreshes dynamically on locale change.
    this.i18n.locale();
    return {
      titleLabel: this.i18n.text('didacticTitleLabel'),
      summaryLabel: this.i18n.text('didacticSummaryLabel'),
      whenAppliesLabel: this.i18n.text('didacticWhenAppliesLabel'),
      rationaleLabel: this.i18n.text('didacticRationaleLabel'),
      customizationGuidanceLabel: this.i18n.text('didacticCustomizationGuidanceLabel'),
      legalBasisCodeLabel: this.i18n.text('legalBasisCodeLabel'),
      legalBasisTitleLabel: this.i18n.text('legalBasisTitleLabel'),
      legalBasisArticleLabel: this.i18n.text('legalBasisArticleLabel'),
      legalBasisJurisdictionLabel: this.i18n.text('legalBasisJurisdictionLabel'),
      legalBasisSummaryLabel: this.i18n.text('legalBasisSummaryLabel'),
      legalBasisUrlLabel: this.i18n.text('legalBasisUrlLabel'),
      maxLengthExceeded: (field, max) => this.i18n.format('didacticMaxLengthExceeded', { field, max }),
      legalBasisMaxEntries: max => this.i18n.format('legalBasisMaxEntries', { max }),
      legalBasisIdentityRequired: index => this.i18n.format('legalBasisIdentityRequired', { index }),
      legalBasisInvalidUrl: index => this.i18n.format('legalBasisInvalidUrl', { index })
    };
  });

  protected readonly validationResult = computed(() =>
    validateRuleDocumentationDetailed(toDescriptor(this.draft()), this.validationMessages())
  );

  constructor() {
    effect(() => {
      const incoming = this.documentationSignal() ?? null;
      const incomingCanonical = JSON.stringify(normalizeAndCompactDocumentation(incoming));
      if (incomingCanonical === this.lastEmittedCanonical) {
        return;
      }
      this.lastEmittedCanonical = incomingCanonical;
      this.draft.set(toDraftState(incoming));
    });

    effect(() => {
      this.validationErrorsChanged.emit(this.validationResult().errors);
    });
  }

  protected toggleExpanded(): void {
    this.userExpanded.set(!this.expanded());
  }

  protected entryValidationFor(index: number): RuleLegalBasisEntryValidation | undefined {
    return this.validationResult().legalBasisErrors.find(item => item.index === index);
  }

  protected isSafeUrl(url: string): boolean {
    return isSafeLegalBasisUrl(url);
  }

  protected updateTextField(
    field: 'title' | 'summary' | 'whenApplies' | 'rationale' | 'customizationGuidance',
    value: string
  ): void {
    const next: DraftDocumentationState = { ...this.draft(), [field]: value };
    this.applyAndEmit(next);
  }

  protected addLegalBasis(): void {
    const current = this.draft();
    if (current.legalBasis.length >= RULE_DOCUMENTATION_LIMITS.legalBasisMaxEntries) {
      return;
    }
    const next: DraftDocumentationState = {
      ...current,
      legalBasis: [
        ...current.legalBasis,
        { code: '', title: '', article: '', jurisdiction: '', summary: '', url: '' }
      ]
    };
    this.applyAndEmit(next);
  }

  protected removeLegalBasis(index: number): void {
    const current = this.draft();
    const next: DraftDocumentationState = {
      ...current,
      legalBasis: current.legalBasis.filter((_, idx) => idx !== index)
    };
    this.applyAndEmit(next);
  }

  protected updateLegalBasisField(
    index: number,
    field: keyof DraftLegalBasisRow,
    value: string
  ): void {
    const current = this.draft();
    const next: DraftDocumentationState = {
      ...current,
      legalBasis: current.legalBasis.map((row, idx) =>
        idx === index ? { ...row, [field]: value } : row
      )
    };
    this.applyAndEmit(next);
  }

  private applyAndEmit(next: DraftDocumentationState): void {
    this.draft.set(next);
    const compacted = normalizeAndCompactDocumentation(toDescriptor(next));
    this.lastEmittedCanonical = JSON.stringify(compacted);
    this.documentationChanged.emit(compacted);
  }
}
