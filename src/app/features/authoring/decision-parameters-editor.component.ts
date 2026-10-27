import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { PolicyStudioI18n } from '../../core/i18n';
import type { DecisionParameterCatalog, DecisionParameterDescriptor } from '../catalog/catalog.fixture';

export type OperationalPolicySlot = 'validationPolicy' | 'availabilityPolicy' | 'approvalPolicy';

export const OPERATIONAL_SLOTS: readonly OperationalPolicySlot[] = [
  'validationPolicy',
  'availabilityPolicy',
  'approvalPolicy'
];

const ALLOWED_ALLOW_SLOT_KEYS = new Set([
  'effect',
  'message',
  'severity',
  'validationMessageTemplate'
]);

const ALLOWED_ALLOW_PARAMETER_KEYS = new Set([
  'resourceKey',
  'actionId',
  'workflowAction',
  'approvalAction',
  'message',
  'severity',
  'validationMessageTemplate'
]);

@Component({
  selector: 'pax-decision-parameters-editor',
  template: `
    <div class="parameters-editor" data-testid="decision-parameters-editor">
      @if (templateParameters().length) {
        <section class="parameters-flat-section" data-testid="parameter-template-section">
          <div class="section-heading">
            <h3>{{ i18n.text('parameterTemplateSection') }}</h3>
            @if (parameterCatalog()?.templateKey) {
              <code class="template-badge">{{ parameterCatalog()!.templateKey }}</code>
            }
          </div>
          <div class="parameters-grid">
            @for (descriptor of templateParameters(); track descriptor.name) {
              <div class="parameter-field" [attr.data-testid]="'parameter-field-' + descriptor.name">
                <label [for]="'param-input-' + descriptor.name">
                  <span>{{ descriptor.label || descriptor.name }}</span>
                  @if (descriptor.unit) {
                    <small class="parameter-unit">({{ descriptor.unit }})</small>
                  }
                </label>
                @if (descriptor.description) {
                  <p class="field-help">{{ descriptor.description }}</p>
                }
                @if (descriptor.allowedValues?.length) {
                  <select
                    [id]="'param-input-' + descriptor.name"
                    [disabled]="descriptor.readOnly"
                    [value]="stringParameterValue(descriptor)"
                    (change)="updateTemplateValue(descriptor, $any($event.target).value)">
                    @if (descriptor.nullable) {
                      <option value="__NULL__">null</option>
                    }
                    @for (allowed of descriptor.allowedValues; track $index) {
                      <option [value]="stringifyAllowed(allowed)">{{ stringifyAllowed(allowed) }}</option>
                    }
                  </select>
                } @else if (descriptor.type === 'BOOLEAN') {
                  <select
                    [id]="'param-input-' + descriptor.name"
                    [disabled]="descriptor.readOnly"
                    [value]="booleanParameterSelectValue(descriptor)"
                    (change)="updateBooleanValue(descriptor, $any($event.target).value)">
                    @if (descriptor.nullable) {
                      <option value="__NULL__">null</option>
                    }
                    <option value="true">{{ i18n.text('booleanTrue') }}</option>
                    <option value="false">{{ i18n.text('booleanFalse') }}</option>
                  </select>
                } @else if (descriptor.type === 'NUMBER' || descriptor.type === 'INTEGER') {
                  <input
                    [id]="'param-input-' + descriptor.name"
                    type="number"
                    [disabled]="descriptor.readOnly"
                    [attr.step]="descriptor.type === 'INTEGER' ? '1' : 'any'"
                    [attr.min]="descriptor.minimum ?? null"
                    [attr.max]="descriptor.maximum ?? null"
                    [value]="numericParameterValue(descriptor)"
                    (input)="updateNumericValue(descriptor, $any($event.target).value)" />
                } @else {
                  <input
                    [id]="'param-input-' + descriptor.name"
                    type="text"
                    [disabled]="descriptor.readOnly"
                    [value]="stringParameterValue(descriptor)"
                    (input)="updateTemplateValue(descriptor, $any($event.target).value)" />
                }
                @if (descriptor.minimum !== null && descriptor.minimum !== undefined || descriptor.maximum !== null && descriptor.maximum !== undefined) {
                  <small class="parameter-bounds">
                    @if (descriptor.minimum !== null && descriptor.minimum !== undefined) {
                      <span>{{ i18n.text('parameterMinimumBound') }} {{ descriptor.minimum }}</span>
                    }
                    @if (descriptor.maximum !== null && descriptor.maximum !== undefined) {
                      <span>{{ i18n.text('parameterMaximumBound') }} {{ descriptor.maximum }}</span>
                    }
                  </small>
                }
                @if (descriptorError(descriptor); as errorText) {
                  <small class="parameter-error" role="alert">{{ errorText }}</small>
                }
              </div>
            }
          </div>
        </section>
      }

      @if (activeOperationalSlot(); as slot) {
        <section class="parameters-flat-section" data-testid="operational-policy-section">
          <div class="section-heading">
            <h3>{{ i18n.text('operationalPolicySection') }}</h3>
            <code class="template-badge">{{ slot }}</code>
          </div>
          <div class="parameters-grid">
            <div class="parameter-field">
              <label for="operational-policy-effect">{{ i18n.text('operationalEffect') }}</label>
              <select
                id="operational-policy-effect"
                data-testid="operational-policy-effect"
                [value]="operationalEffect(slot)"
                (change)="updateOperationalField(slot, 'effect', $any($event.target).value)">
                <option value="BLOCK">{{ i18n.text('operationalEffectBlock') }}</option>
                <option value="ALLOW">{{ i18n.text('operationalEffectAllow') }}</option>
              </select>
            </div>
            <div class="parameter-field">
              <label for="operational-policy-message">{{ i18n.text('operationalMessage') }}</label>
              <input
                id="operational-policy-message"
                data-testid="operational-policy-message"
                type="text"
                [value]="operationalStringField(slot, 'message')"
                (input)="updateOperationalField(slot, 'message', $any($event.target).value)" />
            </div>
            <div class="parameter-field">
              <label for="operational-policy-severity">{{ i18n.text('operationalSeverity') }}</label>
              <input
                id="operational-policy-severity"
                data-testid="operational-policy-severity"
                type="text"
                [value]="operationalStringField(slot, 'severity')"
                (input)="updateOperationalField(slot, 'severity', $any($event.target).value)" />
            </div>
          </div>
        </section>
      }
    </div>
  `,
  styles: [`
    .parameters-editor {
      display: grid;
      gap: 1rem;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--line, rgba(15, 23, 42, 0.12));
    }
    .parameters-flat-section {
      display: grid;
      gap: 0.75rem;
    }
    .section-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .section-heading h3 {
      margin: 0;
      font-size: 0.92rem;
    }
    .template-badge {
      font-size: 0.78rem;
      opacity: 0.85;
    }
    .parameters-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
      gap: 0.75rem;
    }
    .parameter-field {
      display: grid;
      gap: 0.3rem;
    }
    .parameter-field label {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--pax-color-on-surface-variant, #52636a);
    }
    .parameter-field input,
    .parameter-field select {
      min-width: 0;
      border: 1px solid var(--pax-color-outline, #718087);
      border-radius: 0.35rem;
      background: var(--pax-color-surface, #fff);
      color: var(--pax-color-on-surface, #172126);
      padding: 0.5rem 0.65rem;
      font-family: inherit;
    }
    .parameter-unit,
    .parameter-bounds {
      display: inline-flex;
      gap: 0.5rem;
      opacity: 0.75;
      font-size: 0.78rem;
    }
    .parameter-error {
      color: var(--danger, #b91c1c);
      font-size: 0.78rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DecisionParametersEditorComponent {
  protected readonly i18n = inject(PolicyStudioI18n);
  readonly parameterCatalog = input<DecisionParameterCatalog | null | undefined>(null);
  readonly parameters = input.required<Readonly<Record<string, unknown>>>();
  readonly parametersChanged = output<Readonly<Record<string, unknown>>>();
  readonly validationErrorsChanged = output<readonly string[]>();

  protected readonly templateParameters = computed(() =>
    this.parameterCatalog()?.parameters ?? []
  );

  /**
   * When a governed `parameterTemplate` is present, `DomainRuleParameters.draftCondition`
   * requires that workspace edits only modify `parameters.parameterValues`. Operational
   * policy slots are therefore editable on non-template operational definitions.
   */
  protected readonly activeOperationalSlot = computed<OperationalPolicySlot | null>(() => {
    if (this.templateParameters().length > 0) return null;
    const current = this.parameters();
    for (const slot of OPERATIONAL_SLOTS) {
      if (this.isRecord(current[slot])) return slot;
    }
    return null;
  });

  protected readonly validationErrors = computed<readonly string[]>(() => {
    const errors: string[] = [];
    for (const descriptor of this.templateParameters()) {
      const err = this.descriptorError(descriptor);
      if (err) errors.push(`${descriptor.name}: ${err}`);
    }
    return errors;
  });

  constructor() {
    effect(() => {
      this.validationErrorsChanged.emit(this.validationErrors());
    });
  }

  descriptorError(descriptor: DecisionParameterDescriptor): string | null {
    const value = this.currentTemplateValue(descriptor);
    const isBlankString = typeof value === 'string' && value.trim() === '';
    if (value === null || value === undefined || isBlankString) {
      if ((descriptor.required || isBlankString) && !descriptor.nullable) {
        return this.i18n.text('parameterRequired');
      }
      return null;
    }
    if (descriptor.type === 'NUMBER' || descriptor.type === 'INTEGER') {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return this.i18n.text('parameterInvalidNumber');
      }
      if (descriptor.type === 'INTEGER' && !Number.isInteger(value)) {
        return this.i18n.text('parameterMustBeInteger');
      }
      if (descriptor.minimum !== null && descriptor.minimum !== undefined && value < descriptor.minimum) {
        return `${this.i18n.text('parameterMinimumBound')} ${descriptor.minimum}`;
      }
      if (descriptor.maximum !== null && descriptor.maximum !== undefined && value > descriptor.maximum) {
        return `${this.i18n.text('parameterMaximumBound')} ${descriptor.maximum}`;
      }
    }
    return null;
  }

  protected stringParameterValue(descriptor: DecisionParameterDescriptor): string {
    const raw = this.currentTemplateValue(descriptor);
    if (raw === null) return descriptor.allowedValues?.length ? '__NULL__' : '';
    return raw === undefined ? '' : String(raw);
  }

  numericParameterValue(descriptor: DecisionParameterDescriptor): string {
    const raw = this.currentTemplateValue(descriptor);
    return typeof raw === 'number' && Number.isFinite(raw) ? String(raw) : '';
  }

  protected booleanParameterSelectValue(descriptor: DecisionParameterDescriptor): string {
    const raw = this.currentTemplateValue(descriptor);
    if (raw === null && descriptor.nullable) return '__NULL__';
    return raw === true ? 'true' : 'false';
  }

  protected stringifyAllowed(value: unknown): string {
    return value === null || value === undefined ? '' : String(value);
  }

  protected updateTemplateValue(descriptor: DecisionParameterDescriptor, rawValue: string): void {
    if (descriptor.readOnly) return;
    const nextValue = rawValue === '__NULL__' && descriptor.nullable ? null : rawValue;
    this.emitTemplateParameter(descriptor.name, nextValue);
  }

  protected updateBooleanValue(descriptor: DecisionParameterDescriptor, rawValue: string): void {
    if (descriptor.readOnly) return;
    const nextValue = rawValue === '__NULL__' && descriptor.nullable
      ? null
      : rawValue === 'true';
    this.emitTemplateParameter(descriptor.name, nextValue);
  }

  updateNumericValue(descriptor: DecisionParameterDescriptor, rawValue: string): void {
    if (descriptor.readOnly) return;
    const trimmed = rawValue.trim();
    if (!trimmed) {
      this.emitTemplateParameter(descriptor.name, descriptor.nullable ? null : '');
      return;
    }
    const parsed = Number(trimmed);
    this.emitTemplateParameter(descriptor.name, Number.isFinite(parsed) ? parsed : trimmed);
  }

  protected operationalEffect(slot: OperationalPolicySlot): 'BLOCK' | 'ALLOW' {
    const slotRecord = this.slotRecord(slot);
    return slotRecord['effect'] === 'ALLOW' ? 'ALLOW' : 'BLOCK';
  }

  protected operationalStringField(slot: OperationalPolicySlot, key: string): string {
    const value = this.slotRecord(slot)[key];
    return typeof value === 'string' ? value : '';
  }

  protected updateOperationalField(slot: OperationalPolicySlot, key: string, rawValue: string): void {
    const current = { ...this.parameters() };
    const nextSlot: Record<string, unknown> = { ...this.slotRecord(slot) };
    if (key === 'effect') {
      nextSlot['effect'] = rawValue === 'ALLOW' ? 'ALLOW' : 'BLOCK';
    } else if (rawValue.trim()) {
      nextSlot[key] = rawValue;
    } else {
      delete nextSlot[key];
    }
    if (nextSlot['effect'] === 'ALLOW') {
      Object.keys(nextSlot).forEach(field => {
        if (!ALLOWED_ALLOW_SLOT_KEYS.has(field)) delete nextSlot[field];
      });
      Object.keys(current).forEach(field => {
        if (field !== slot && !ALLOWED_ALLOW_PARAMETER_KEYS.has(field)) {
          delete current[field];
        }
      });
    }
    current[slot] = nextSlot;
    this.parametersChanged.emit(current);
  }

  private currentTemplateValue(descriptor: DecisionParameterDescriptor): unknown {
    const values = this.parameterValuesRecord();
    if (Object.prototype.hasOwnProperty.call(values, descriptor.name)) {
      return values[descriptor.name];
    }
    return descriptor.effectiveValue ?? descriptor.defaultValue;
  }

  private emitTemplateParameter(name: string, value: unknown): void {
    const current = { ...this.parameters() };
    const values = { ...this.parameterValuesRecord(), [name]: value };
    current['parameterValues'] = values;
    this.parametersChanged.emit(current);
  }

  private parameterValuesRecord(): Record<string, unknown> {
    const raw = this.parameters()['parameterValues'];
    return this.isRecord(raw) ? raw : {};
  }

  private slotRecord(slot: OperationalPolicySlot): Record<string, unknown> {
    const raw = this.parameters()[slot];
    return this.isRecord(raw) ? raw : {};
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }
}
