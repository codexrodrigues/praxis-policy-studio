import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import type { DomainRuleDefinitionRequest } from '@praxisui/core';
import { PolicyStudioI18n } from '../../core/i18n';
import {
  mergeRuleDocumentation,
  normalizeAndCompactDocumentation,
  type RuleDocumentationDescriptor
} from '../../core/rule-documentation';
import { DecisionDocumentationEditorComponent } from '../authoring/decision-documentation-editor.component';

@Component({
  selector: 'pax-decision-create-form',
  imports: [DecisionDocumentationEditorComponent],
  template: `
    <div class="decision-create-shell" data-testid="decision-create-shell">
      <button
        type="button"
        class="create-trigger quiet-button"
        data-testid="toggle-new-decision"
        [disabled]="busy()"
        (click)="openModal()">
        <span aria-hidden="true">+</span>
        <span>{{ open() ? i18n.text('closeNewDecision') : i18n.text('newDecision') }}</span>
      </button>

      <dialog
        #createDialog
        class="create-modal-dialog"
        aria-labelledby="new-decision-modal-title"
        [attr.data-testid]="open() ? 'decision-create-form' : null"
        (cancel)="onDialogCancel($event)"
        (close)="onNativeClose()"
        (click)="onBackdropClick($event)">
        @if (open()) {
          <div class="create-modal-surface">
            <header class="create-modal-header">
              <div>
                <p class="studio-eyebrow">{{ i18n.text('trackBusinessRules') }}</p>
                <h2 id="new-decision-modal-title">{{ i18n.text('newDecisionModalTitle') }}</h2>
              </div>
              <button
                type="button"
                class="quiet-button modal-close-btn"
                [attr.aria-label]="i18n.text('closeModal')"
                [disabled]="busy()"
                (click)="closeModal()">
                ×
              </button>
            </header>

            <div class="create-flat-form studio-scroll-region">
              <div class="field-pair">
                <div class="field-group">
                  <label for="new-decision-rule-key">{{ i18n.text('decisionKeyLabel') }}</label>
                  <input
                    id="new-decision-rule-key"
                    data-testid="new-decision-rule-key"
                    type="text"
                    [value]="ruleKey()"
                    (input)="ruleKey.set($any($event.target).value)" />
                </div>
                <div class="field-group">
                  <label for="new-decision-rule-type">{{ i18n.text('decisionRuleTypeLabel') }}</label>
                  <select
                    id="new-decision-rule-type"
                    data-testid="new-decision-rule-type"
                    [value]="ruleType()"
                    (change)="ruleType.set($any($event.target).value)">
                    <option value="validation">{{ i18n.text('ruleTypeValidation') }}</option>
                    <option value="approval_policy">{{ i18n.text('ruleTypeApprovalPolicy') }}</option>
                    <option value="workflow_action_policy">{{ i18n.text('ruleTypeWorkflowActionPolicy') }}</option>
                    <option value="compliance">{{ i18n.text('ruleTypeCompliance') }}</option>
                    <option value="privacy">{{ i18n.text('ruleTypePrivacy') }}</option>
                    <option value="selection_eligibility">{{ i18n.text('ruleTypeSelectionEligibility') }}</option>
                  </select>
                </div>
              </div>

              <div class="field-pair">
                <div class="field-group">
                  <label for="new-decision-context-key">{{ i18n.text('decisionContextKeyLabel') }}</label>
                  <input
                    id="new-decision-context-key"
                    data-testid="new-decision-context-key"
                    type="text"
                    [value]="contextKey()"
                    (input)="contextKey.set($any($event.target).value)" />
                </div>
                <div class="field-group">
                  <label for="new-decision-resource-key">{{ i18n.text('decisionResourceKeyLabel') }}</label>
                  <input
                    id="new-decision-resource-key"
                    data-testid="new-decision-resource-key"
                    type="text"
                    [value]="resourceKey()"
                    (input)="resourceKey.set($any($event.target).value)" />
                </div>
              </div>

              <div class="field-pair">
                <div class="field-group">
                  <label for="new-decision-service-key">{{ i18n.text('decisionServiceKeyLabel') }}</label>
                  <input
                    id="new-decision-service-key"
                    data-testid="new-decision-service-key"
                    type="text"
                    [value]="serviceKey()"
                    (input)="serviceKey.set($any($event.target).value)" />
                </div>
                <div class="field-group">
                  <label for="new-decision-effect">{{ i18n.text('operationalEffect') }}</label>
                  <select
                    id="new-decision-effect"
                    data-testid="new-decision-effect"
                    [value]="effect()"
                    (change)="effect.set($any($event.target).value === 'ALLOW' ? 'ALLOW' : 'BLOCK')">
                    <option value="BLOCK">{{ i18n.text('operationalEffectBlock') }}</option>
                    <option value="ALLOW">{{ i18n.text('operationalEffectAllow') }}</option>
                  </select>
                </div>
              </div>

              @if (supportsActionId()) {
                <div class="field-group">
                  <label for="new-decision-action-id">{{ i18n.text('decisionActionIdLabel') }}</label>
                  <input
                    id="new-decision-action-id"
                    data-testid="new-decision-action-id"
                    type="text"
                    [value]="actionId()"
                    (input)="actionId.set($any($event.target).value)" />
                </div>
              }

              <pax-decision-documentation-editor
                idPrefix="create-doc"
                [collapsedByDefault]="true"
                [documentation]="draftDocumentation()"
                [disabled]="busy()"
                (documentationChanged)="draftDocumentation.set($event)"
                (validationErrorsChanged)="documentationErrors.set($event)" />
            </div>

            <footer class="create-modal-footer">
              <button
                type="button"
                class="quiet-button"
                [disabled]="busy()"
                (click)="closeModal()">
                {{ i18n.text('cancel') }}
              </button>
              <button
                type="button"
                class="primary-action"
                data-testid="submit-new-decision"
                [disabled]="busy()"
                (click)="submit()">
                {{ i18n.text('createGovernedDecision') }}
              </button>
            </footer>
          </div>
        }
      </dialog>
    </div>
  `,
  styles: [`
    .decision-create-shell {
      display: grid;
    }
    .create-trigger {
      width: 100%;
      min-height: 2.25rem;
      height: 2.25rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      border-color: var(--pax-color-outline-variant);
      background: var(--pax-color-surface);
      color: var(--pax-color-on-surface);
      font-size: 0.8rem;
    }
    .create-modal-dialog {
      width: min(44rem, calc(100vw - 2rem));
      max-width: none;
      max-height: min(88vh, 54rem);
      max-height: min(88dvh, 54rem);
      margin: auto;
      padding: 0;
      border: 0;
      border-radius: 0.9rem;
      background: transparent;
      color: var(--pax-color-on-surface);
      box-shadow: var(--pax-shadow-popover);
      overflow: hidden;
    }
    .create-modal-dialog[open] {
      display: grid;
      grid-template-rows: minmax(0, 1fr);
    }
    .create-modal-dialog:modal {
      overscroll-behavior: contain;
    }
    .create-modal-dialog::backdrop {
      background: color-mix(in oklab, var(--pax-color-on-surface) 38%, transparent);
      backdrop-filter: blur(2px);
      overflow: hidden;
      overscroll-behavior: contain;
    }
    .create-modal-surface {
      width: 100%;
      height: 100%;
      max-height: inherit;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      border-radius: 0.9rem;
      border: 1px solid var(--pax-color-outline-variant);
      background: var(--pax-color-surface);
      color: var(--pax-color-on-surface);
      overflow: hidden;
    }
    .create-modal-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--pax-color-outline-variant);
      background: var(--pax-color-surface-container-low);
    }
    .create-modal-header h2 {
      margin: 0.2rem 0 0;
      font-size: 1.08rem;
      letter-spacing: -0.015em;
    }
    .modal-close-btn {
      padding: 0.25rem 0.65rem;
      font-size: 1.1rem;
      line-height: 1.2;
    }
    .create-flat-form {
      overflow: auto;
      overscroll-behavior: contain;
      padding: 1.15rem 1.25rem;
      display: grid;
      gap: 0.85rem;
      align-content: start;
    }
    .field-pair {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
    }
    .field-group {
      display: grid;
      gap: 0.3rem;
      min-width: 0;
    }
    .field-group label {
      font-size: 0.76rem;
      font-weight: 700;
      color: var(--pax-color-on-surface-variant);
    }
    .field-group input,
    .field-group select {
      min-width: 0;
      border: 1px solid var(--pax-color-outline);
      border-radius: 0.45rem;
      background: var(--pax-color-surface-container-lowest);
      color: var(--pax-color-on-surface);
      padding: 0.5rem 0.65rem;
      font-family: inherit;
    }
    .field-group input:focus-visible,
    .field-group select:focus-visible {
      outline: 2px solid var(--pax-color-primary);
      outline-offset: 1px;
    }
    .create-modal-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.65rem;
      padding: 0.85rem 1.25rem;
      border-top: 1px solid var(--pax-color-outline-variant);
      background: var(--pax-color-surface-container-low);
    }
    @media (max-width: 640px) {
      .field-pair {
        grid-template-columns: 1fr;
      }
      .create-modal-dialog {
        width: calc(100vw - 1.5rem);
        max-height: 92vh;
        max-height: 92dvh;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DecisionCreateFormComponent {
  protected readonly i18n = inject(PolicyStudioI18n);
  readonly busy = input(false);
  readonly createRequested = output<DomainRuleDefinitionRequest>();
  readonly validationFailed = output<string>();

  private readonly createDialog = viewChild<ElementRef<HTMLDialogElement>>('createDialog');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly open = signal(false);
  protected readonly ruleKey = signal('');
  protected readonly ruleType = signal('validation');
  protected readonly contextKey = signal('');
  protected readonly resourceKey = signal('');
  protected readonly serviceKey = signal('');
  protected readonly actionId = signal('');
  protected readonly effect = signal<'BLOCK' | 'ALLOW'>('BLOCK');
  protected readonly draftDocumentation = signal<RuleDocumentationDescriptor | null>(null);
  protected readonly documentationErrors = signal<readonly string[]>([]);
  protected readonly supportsActionId = computed(() => {
    const type = this.ruleType().trim();
    return type === 'approval_policy' || type === 'workflow_action_policy';
  });

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const dialog = this.dialogElement();
      if (!dialog) return;
      this.syncDialogElement(dialog, isOpen);
    });
  }

  protected openModal(): void {
    const nextOpen = !this.open();
    this.open.set(nextOpen);
    const dialog = this.dialogElement();
    if (dialog) {
      this.syncDialogElement(dialog, nextOpen);
    }
  }

  protected closeModal(): void {
    if (this.busy()) return;
    this.closeDialogElement();
    this.open.set(false);
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  protected onDialogCancel(event: Event): void {
    event.preventDefault();
    this.closeModal();
  }

  protected onNativeClose(): void {
    if (this.open() && !this.busy()) {
      this.open.set(false);
    }
  }

  private closeDialogElement(): void {
    const dialog = this.dialogElement();
    if (dialog) {
      this.syncDialogElement(dialog, false);
    }
  }

  private dialogElement(): HTMLDialogElement | null {
    return this.createDialog()?.nativeElement ?? this.host.nativeElement.querySelector('dialog.create-modal-dialog');
  }

  private syncDialogElement(dialog: HTMLDialogElement, open: boolean): void {
    if (open) {
      if (typeof dialog.showModal === 'function') {
        if (!dialog.open) dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
      if (typeof document !== 'undefined' && document.activeElement === dialog) {
        const firstInteractive = dialog.querySelector<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
        );
        firstInteractive?.focus();
      }
      return;
    }
    if (typeof dialog.close === 'function') {
      if (dialog.open) dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  protected submit(): void {
    const key = this.ruleKey().trim();
    const type = this.ruleType().trim();
    const resource = this.resourceKey().trim();
    if (!key || !type || !resource) {
      this.validationFailed.emit(this.i18n.text('decisionIdentityRequired'));
      return;
    }
    const docErrors = this.documentationErrors();
    if (docErrors.length > 0) {
      this.validationFailed.emit(docErrors[0] ?? this.i18n.text('didacticValidationBlocked'));
      return;
    }
    const slot = type === 'approval_policy'
      ? 'approvalPolicy'
      : type === 'workflow_action_policy'
      ? 'availabilityPolicy'
      : 'validationPolicy';
    const selectedEffect = this.effect();
    const action = this.actionId().trim();
    const parameters: Record<string, unknown> = {
      resourceKey: resource,
      [slot]: { effect: selectedEffect }
    };
    if (selectedEffect === 'BLOCK') {
      parameters['nullSemantics'] = 'FAIL_CLOSED';
    }
    if (action && type === 'approval_policy') {
      parameters['actionId'] = action;
      parameters['approvalAction'] = action;
    } else if (action && type === 'workflow_action_policy') {
      parameters['actionId'] = action;
      parameters['workflowAction'] = action;
    }
    const normalizedDoc = normalizeAndCompactDocumentation(this.draftDocumentation());
    this.createRequested.emit({
      ruleKey: key,
      version: 1,
      ruleType: type,
      status: 'draft',
      contextKey: this.contextKey().trim() || resource.split('.')[0] || 'domain',
      resourceKey: resource,
      serviceKey: this.serviceKey().trim() || null,
      definition: mergeRuleDocumentation({}, normalizedDoc),
      parameters,
      condition: null,
      governance: {
        lifecycleBoundary: 'domain_rule_change_workspace',
        ruleAuthoring: 'review_required',
        requiredApprovals: ['human-review']
      }
    });
    this.closeDialogElement();
    this.open.set(false);
    this.ruleKey.set('');
    this.actionId.set('');
    this.draftDocumentation.set(null);
    this.documentationErrors.set([]);
  }
}
