import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { PolicyStudioI18n } from '../../core/i18n';
import type { DomainRuleDefinitionRequest } from '@praxisui/core';

@Component({
  selector: 'pax-decision-create-form',
  template: `
    <div class="decision-create-shell" data-testid="decision-create-shell">
      <div class="create-header">
        <button
          type="button"
          class="secondary-action"
          data-testid="toggle-new-decision"
          [disabled]="busy()"
          (click)="toggleOpen()">
          {{ open() ? i18n.text('closeNewDecision') : i18n.text('newDecision') }}
        </button>
      </div>

      @if (open()) {
        <section class="create-flat-form" data-testid="decision-create-form">
          <label for="new-decision-rule-key">{{ i18n.text('decisionKeyLabel') }}</label>
          <input
            id="new-decision-rule-key"
            data-testid="new-decision-rule-key"
            type="text"
            [value]="ruleKey()"
            (input)="ruleKey.set($any($event.target).value)" />

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

          <label for="new-decision-context-key">{{ i18n.text('decisionContextKeyLabel') }}</label>
          <input
            id="new-decision-context-key"
            data-testid="new-decision-context-key"
            type="text"
            [value]="contextKey()"
            (input)="contextKey.set($any($event.target).value)" />

          <label for="new-decision-resource-key">{{ i18n.text('decisionResourceKeyLabel') }}</label>
          <input
            id="new-decision-resource-key"
            data-testid="new-decision-resource-key"
            type="text"
            [value]="resourceKey()"
            (input)="resourceKey.set($any($event.target).value)" />

          <label for="new-decision-service-key">{{ i18n.text('decisionServiceKeyLabel') }}</label>
          <input
            id="new-decision-service-key"
            data-testid="new-decision-service-key"
            type="text"
            [value]="serviceKey()"
            (input)="serviceKey.set($any($event.target).value)" />

          @if (supportsActionId()) {
            <label for="new-decision-action-id">{{ i18n.text('decisionActionIdLabel') }}</label>
            <input
              id="new-decision-action-id"
              data-testid="new-decision-action-id"
              type="text"
              [value]="actionId()"
              (input)="actionId.set($any($event.target).value)" />
          }

          <label for="new-decision-effect">{{ i18n.text('operationalEffect') }}</label>
          <select
            id="new-decision-effect"
            data-testid="new-decision-effect"
            [value]="effect()"
            (change)="effect.set($any($event.target).value === 'ALLOW' ? 'ALLOW' : 'BLOCK')">
            <option value="BLOCK">{{ i18n.text('operationalEffectBlock') }}</option>
            <option value="ALLOW">{{ i18n.text('operationalEffectAllow') }}</option>
          </select>

          <button
            type="button"
            class="primary-action"
            data-testid="submit-new-decision"
            [disabled]="busy()"
            (click)="submit()">
            {{ i18n.text('createGovernedDecision') }}
          </button>
        </section>
      }
    </div>
  `,
  styles: [`
    .decision-create-shell {
      display: grid;
      gap: 0.65rem;
      margin-bottom: 0.75rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--line, rgba(15, 23, 42, 0.12));
    }
    .create-flat-form {
      display: grid;
      gap: 0.45rem;
    }
    .create-flat-form label {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--pax-color-on-surface-variant, #52636a);
    }
    .create-flat-form input,
    .create-flat-form select {
      min-width: 0;
      border: 1px solid var(--pax-color-outline, #718087);
      border-radius: 0.35rem;
      background: var(--pax-color-surface, #fff);
      color: var(--pax-color-on-surface, #172126);
      padding: 0.5rem 0.65rem;
      font-family: inherit;
    }
    .decision-create-shell button {
      border: 1px solid var(--pax-color-outline, #718087);
      border-radius: 0.5rem;
      background: var(--pax-color-surface, #fff);
      color: var(--pax-color-on-surface, #172126);
      padding: 0.5rem 0.75rem;
      font-weight: 600;
    }
    .decision-create-shell .primary-action {
      margin-top: 0.25rem;
      border-color: var(--pax-color-primary, #076487);
      background: var(--pax-color-primary, #076487);
      color: var(--pax-color-on-primary, #fff);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DecisionCreateFormComponent {
  protected readonly i18n = inject(PolicyStudioI18n);
  readonly busy = input(false);
  readonly createRequested = output<DomainRuleDefinitionRequest>();
  readonly validationFailed = output<string>();

  protected readonly open = signal(false);
  protected readonly ruleKey = signal('');
  protected readonly ruleType = signal('validation');
  protected readonly contextKey = signal('');
  protected readonly resourceKey = signal('');
  protected readonly serviceKey = signal('');
  protected readonly actionId = signal('');
  protected readonly effect = signal<'BLOCK' | 'ALLOW'>('BLOCK');
  protected readonly supportsActionId = computed(() => {
    const type = this.ruleType().trim();
    return type === 'approval_policy' || type === 'workflow_action_policy';
  });

  protected toggleOpen(): void {
    this.open.update(value => !value);
  }

  protected submit(): void {
    const key = this.ruleKey().trim();
    const type = this.ruleType().trim();
    const resource = this.resourceKey().trim();
    if (!key || !type || !resource) {
      this.validationFailed.emit(this.i18n.text('decisionIdentityRequired'));
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
    this.createRequested.emit({
      ruleKey: key,
      version: 1,
      ruleType: type,
      status: 'draft',
      contextKey: this.contextKey().trim() || resource.split('.')[0] || 'domain',
      resourceKey: resource,
      serviceKey: this.serviceKey().trim() || null,
      definition: {},
      parameters,
      condition: null,
      governance: {
        lifecycleBoundary: 'domain_rule_change_workspace',
        ruleAuthoring: 'review_required',
        requiredApprovals: ['human-review']
      }
    });
    this.open.set(false);
    this.ruleKey.set('');
    this.actionId.set('');
  }
}
