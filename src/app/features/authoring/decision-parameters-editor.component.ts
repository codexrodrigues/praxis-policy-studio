import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { humanizeTechnicalSlug, localizeGenericUnit, looksLikeTechnicalSlug } from '../../core/humanize-labels';
import { PolicyStudioI18n } from '../../core/i18n';
import type {
  DecisionParameterCatalog,
  DecisionParameterDescriptor,
  DecisionParameterInvariant
} from '../catalog/catalog.fixture';

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

const ORDER_COMPARE_OPS: Readonly<Record<string, (left: number, right: number) => boolean>> = {
  '<=': (left, right) => left <= right,
  '<': (left, right) => left < right,
  '>=': (left, right) => left >= right,
  '>': (left, right) => left > right
};

export interface DecisionParameterGroup {
  readonly key: string;
  readonly label: string;
  readonly parameters: readonly DecisionParameterDescriptor[];
}

function normalizeParameterVarName(raw: unknown): string | null {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (typeof candidate !== 'string') return null;
  const trimmed = candidate.trim();
  const normalized = trimmed.startsWith('parameterValues.')
    ? trimmed.slice('parameterValues.'.length)
    : trimmed;
  return normalized || null;
}

function collectInvariantParameterNames(node: unknown, target: Set<string>, depth: number): void {
  if (!node || typeof node !== 'object' || depth > 32) return;
  if (Array.isArray(node)) {
    for (const item of node) {
      collectInvariantParameterNames(item, target, depth + 1);
    }
    return;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === 'var') {
      const name = normalizeParameterVarName(value);
      if (name) target.add(name);
    } else {
      collectInvariantParameterNames(value, target, depth + 1);
    }
  }
}

/**
 * Extracts scalar parameter names referenced by {@code {"var": ...}} nodes inside a Contract 1.8
 * cross-parameter invariant expression.
 */
export function extractInvariantParameterNames(expression: unknown): ReadonlySet<string> {
  const names = new Set<string>();
  collectInvariantParameterNames(expression, names, 0);
  return names;
}

function looseInvariantEquals(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || left === undefined || right === null || right === undefined) {
    return false;
  }
  if (typeof left === 'number' && typeof right === 'string') {
    const trimmed = right.trim();
    return trimmed !== '' && Number.isFinite(Number(trimmed)) && left === Number(trimmed);
  }
  if (typeof left === 'string' && typeof right === 'number') {
    const trimmed = left.trim();
    return trimmed !== '' && Number.isFinite(Number(trimmed)) && Number(trimmed) === right;
  }
  if (typeof left === 'boolean' && typeof right === 'number') {
    return Number(left) === right;
  }
  if (typeof left === 'number' && typeof right === 'boolean') {
    return left === Number(right);
  }
  return false;
}

function evaluateInvariantOperand(
  node: unknown,
  effectiveValues: Readonly<Record<string, unknown>>
): unknown {
  if (node === null || typeof node === 'boolean' || typeof node === 'string') return node;
  if (typeof node === 'number') return Number.isFinite(node) ? node : undefined;
  if (!node || typeof node !== 'object' || Array.isArray(node)) return undefined;
  const entries = Object.entries(node as Record<string, unknown>);
  if (entries.length !== 1) return undefined;
  const [op, raw] = entries[0];
  if (op === 'var') {
    const key = normalizeParameterVarName(raw);
    return key && Object.prototype.hasOwnProperty.call(effectiveValues, key)
      ? effectiveValues[key]
      : undefined;
  }
  if (op === '+' && Array.isArray(raw) && raw.length >= 2) {
    let total = 0;
    for (const item of raw) {
      const val = evaluateInvariantOperand(item, effectiveValues);
      if (typeof val !== 'number' || !Number.isFinite(val)) return undefined;
      total += val;
    }
    return total;
  }
  if (op === '-' && Array.isArray(raw) && (raw.length === 1 || raw.length === 2)) {
    const first = evaluateInvariantOperand(raw[0], effectiveValues);
    if (typeof first !== 'number' || !Number.isFinite(first)) return undefined;
    if (raw.length === 1) return -first;
    const second = evaluateInvariantOperand(raw[1], effectiveValues);
    if (typeof second !== 'number' || !Number.isFinite(second)) return undefined;
    return first - second;
  }
  return undefined;
}

/**
 * Evaluates a cross-parameter Contract 1.8 JSON Logic invariant client-side against resolved
 * scalar parameter values. Returns `null` when an expression cannot be previewed safely in UI
 * (failing open so authoritative server enforcement stays definitive).
 */
export function evaluateParameterInvariant(
  expression: unknown,
  effectiveValues: Readonly<Record<string, unknown>>
): boolean | null {
  if (typeof expression === 'boolean') return expression;
  if (!expression || typeof expression !== 'object' || Array.isArray(expression)) return null;
  const entries = Object.entries(expression as Record<string, unknown>);
  if (entries.length !== 1) return null;
  const [op, raw] = entries[0];
  if ((op === 'and' || op === 'or') && Array.isArray(raw)) {
    let indeterminate = false;
    for (const item of raw) {
      const result = evaluateParameterInvariant(item, effectiveValues);
      if (result === null) {
        indeterminate = true;
      } else if (op === 'and' && !result) {
        return false;
      } else if (op === 'or' && result) {
        return true;
      }
    }
    if (indeterminate) return null;
    return op === 'and';
  }
  if (op === '!' || op === 'not') {
    const inner = Array.isArray(raw) ? raw[0] : raw;
    const result = evaluateParameterInvariant(inner, effectiveValues);
    return result === null ? null : !result;
  }
  if (!Array.isArray(raw) || raw.length < 2) return null;
  if (op in ORDER_COMPARE_OPS) {
    if (raw.length !== 2 && raw.length !== 3) return null;
    const values: number[] = [];
    for (const operand of raw) {
      const evaluated = evaluateInvariantOperand(operand, effectiveValues);
      if (typeof evaluated !== 'number' || !Number.isFinite(evaluated)) return null;
      values.push(evaluated);
    }
    const compare = ORDER_COMPARE_OPS[op];
    for (let i = 0; i < values.length - 1; i++) {
      if (!compare(values[i]!, values[i + 1]!)) return false;
    }
    return true;
  }
  const left = evaluateInvariantOperand(raw[0], effectiveValues);
  const right = evaluateInvariantOperand(raw[1], effectiveValues);
  if (left === undefined || right === undefined) return null;
  if (op === '===') return left === right;
  if (op === '!==') return left !== right;
  if (op === '==') return looseInvariantEquals(left, right);
  if (op === '!=') return !looseInvariantEquals(left, right);
  return null;
}

@Component({
  selector: 'pax-decision-parameters-editor',
  imports: [NgTemplateOutlet],
  template: `
    <ng-template #parameterFieldTemplate let-descriptor>
      <div class="parameter-field" [attr.data-testid]="'parameter-field-' + descriptor.name">
        <label [for]="'param-input-' + descriptor.name">
          <span>{{ descriptor.label || descriptor.name }}</span>
          @if (localizedUnit(descriptor.unit); as unitText) {
            <small class="parameter-unit">({{ unitText }})</small>
          }
        </label>
        @if (descriptor.description) {
          <p [id]="'param-help-' + descriptor.name" class="field-help">{{ descriptor.description }}</p>
        }
        @if (descriptor.legalBasis) {
          <small [id]="'param-legal-' + descriptor.name" class="parameter-legal-basis">
            <strong>{{ i18n.text('parameterLegalBasis') }}</strong> {{ descriptor.legalBasis }}
          </small>
        }
        @if (descriptor.allowedValues?.length) {
          <select
            [id]="'param-input-' + descriptor.name"
            [disabled]="descriptor.readOnly"
            [attr.aria-invalid]="isFieldInvalid(descriptor) ? 'true' : null"
            [attr.aria-describedby]="describedByIds(descriptor)"
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
            [attr.aria-invalid]="isFieldInvalid(descriptor) ? 'true' : null"
            [attr.aria-describedby]="describedByIds(descriptor)"
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
            [attr.aria-invalid]="isFieldInvalid(descriptor) ? 'true' : null"
            [attr.aria-describedby]="describedByIds(descriptor)"
            [value]="numericParameterValue(descriptor)"
            (input)="updateNumericValue(descriptor, $any($event.target).value)" />
        } @else {
          <input
            [id]="'param-input-' + descriptor.name"
            type="text"
            [disabled]="descriptor.readOnly"
            [attr.aria-invalid]="isFieldInvalid(descriptor) ? 'true' : null"
            [attr.aria-describedby]="describedByIds(descriptor)"
            [value]="stringParameterValue(descriptor)"
            (input)="updateTemplateValue(descriptor, $any($event.target).value)" />
        }
        @if (descriptor.minimum !== null && descriptor.minimum !== undefined || descriptor.maximum !== null && descriptor.maximum !== undefined) {
          <small [id]="'param-bounds-' + descriptor.name" class="parameter-bounds">
            @if (descriptor.minimum !== null && descriptor.minimum !== undefined) {
              <span>{{ i18n.text('parameterMinimumBound') }} {{ descriptor.minimum }}</span>
            }
            @if (descriptor.maximum !== null && descriptor.maximum !== undefined) {
              <span>{{ i18n.text('parameterMaximumBound') }} {{ descriptor.maximum }}</span>
            }
          </small>
        }
        @if (descriptorError(descriptor); as errorText) {
          <small [id]="'param-error-' + descriptor.name" class="parameter-error" role="alert">{{ errorText }}</small>
        }
      </div>
    </ng-template>

    <div class="parameters-editor" data-testid="decision-parameters-editor">
      @if (templateParameters().length) {
        <section class="parameters-flat-section" data-testid="parameter-template-section">
          <div class="section-heading">
            <h3>{{ i18n.text('parameterTemplateSection') }}</h3>
            @if (parameterCatalog()?.templateKey) {
              <code class="template-badge">{{ parameterCatalog()!.templateKey }}</code>
            }
          </div>
          @if (parameterGroups().length) {
            <div class="parameter-groups">
              @for (group of parameterGroups(); track group.key) {
                <fieldset class="parameter-group" [attr.data-testid]="'parameter-group-' + group.key">
                  <legend>{{ group.label }}</legend>
                  <div class="parameters-grid">
                    @for (descriptor of group.parameters; track descriptor.name) {
                      <ng-container *ngTemplateOutlet="parameterFieldTemplate; context: { $implicit: descriptor }" />
                    }
                  </div>
                </fieldset>
              }
            </div>
          } @else {
            <div class="parameters-grid">
              @for (descriptor of templateParameters(); track descriptor.name) {
                <ng-container *ngTemplateOutlet="parameterFieldTemplate; context: { $implicit: descriptor }" />
              }
            </div>
          }
          @if (invariantStates().length) {
            <div class="parameters-invariants" data-testid="parameter-invariants-section">
              <h4>{{ i18n.text('parameterInvariantsTitle') }}</h4>
              <ul class="invariant-list">
                @for (state of invariantStates(); track state.invariant.code) {
                  <li
                    [id]="'parameter-invariant-' + state.invariant.code"
                    class="invariant-item"
                    [class.violated]="state.violated"
                    [attr.data-testid]="'parameter-invariant-' + state.invariant.code"
                    [attr.role]="state.violated ? 'alert' : null">
                    @if (state.violated) {
                      <strong class="invariant-status">{{ i18n.text('parameterInvariantViolated') }}</strong>
                    }
                    <span>{{ state.invariant.message || state.invariant.code }}</span>
                  </li>
                }
              </ul>
            </div>
          }
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
    .parameter-field:has([aria-invalid="true"]),
    .parameter-field:has(:user-invalid) {
      border-inline-start: 3px solid var(--danger, #b91c1c);
      padding-inline-start: 0.5rem;
    }
    .parameter-groups {
      display: grid;
      gap: 0.85rem;
    }
    .parameter-group {
      border: 1px solid var(--line, rgba(15, 23, 42, 0.14));
      border-radius: 0.45rem;
      padding: 0.75rem;
      margin: 0;
    }
    .parameter-group:has([aria-invalid="true"]),
    .parameter-group:has(:user-invalid) {
      border-color: var(--danger, #b91c1c);
      background-color: rgba(185, 28, 28, 0.03);
    }
    .parameter-group legend {
      font-size: 0.8rem;
      font-weight: 700;
      padding-inline: 0.35rem;
      color: var(--pax-color-on-surface-variant, #52636a);
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
    .parameter-field input:focus-visible,
    .parameter-field select:focus-visible {
      outline: 3px solid var(--pax-color-primary, #0b57d0);
      outline-offset: 2px;
    }
    .parameter-unit,
    .parameter-bounds,
    .parameter-legal-basis {
      display: inline-flex;
      gap: 0.35rem;
      color: var(--pax-color-on-surface-variant, #52636a);
      font-size: 0.78rem;
      line-height: 1.35;
    }
    .parameter-error {
      color: var(--danger, #b91c1c);
      font-size: 0.78rem;
    }
    .parameters-invariants {
      display: grid;
      gap: 0.45rem;
      padding: 0.65rem 0.75rem;
      border: 1px solid var(--line, rgba(15, 23, 42, 0.14));
      border-radius: 0.45rem;
      background: var(--pax-color-surface-container-low, rgba(15, 23, 42, 0.03));
    }
    .parameters-invariants h4 {
      margin: 0;
      font-size: 0.82rem;
      color: var(--pax-color-on-surface-variant, #52636a);
    }
    .invariant-list {
      margin: 0;
      padding-inline-start: 1.15rem;
      display: grid;
      gap: 0.35rem;
      font-size: 0.8rem;
    }
    .invariant-item.violated {
      color: var(--danger, #b91c1c);
      font-weight: 600;
    }
    .invariant-status {
      margin-inline-end: 0.3rem;
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

  readonly templateInvariants = computed<readonly DecisionParameterInvariant[]>(() =>
    this.parameterCatalog()?.invariants ?? []
  );

  protected readonly effectiveTemplateValues = computed<Readonly<Record<string, unknown>>>(() => {
    const resolved: Record<string, unknown> = {};
    for (const descriptor of this.templateParameters()) {
      const value = this.currentTemplateValue(descriptor);
      if (value !== undefined) {
        resolved[descriptor.name] = value;
      }
    }
    return resolved;
  });

  readonly invariantStates = computed(() => {
    const effective = this.effectiveTemplateValues();
    return this.templateInvariants().map(invariant => ({
      invariant,
      violated: evaluateParameterInvariant(invariant.expression, effective) === false,
      parameterNames: extractInvariantParameterNames(invariant.expression)
    }));
  });

  readonly parameterGroups = computed<readonly DecisionParameterGroup[]>(() => {
    const params = this.templateParameters();
    if (!params.some(descriptor => !!descriptor.group?.trim())) {
      return [];
    }
    const grouped = new Map<string, DecisionParameterDescriptor[]>();
    for (const descriptor of params) {
      const rawGroup = descriptor.group?.trim() || '__ungrouped__';
      const bucket = grouped.get(rawGroup);
      if (bucket) {
        bucket.push(descriptor);
      } else {
        grouped.set(rawGroup, [descriptor]);
      }
    }
    const locale = this.i18n.locale();
    return Array.from(grouped.entries()).map(([key, items]) => ({
      key,
      label: key === '__ungrouped__'
        ? this.i18n.text('parameterGroupOther')
        : (looksLikeTechnicalSlug(key) || !/\s/.test(key)
            ? humanizeTechnicalSlug(key, undefined, locale)
            : key),
      parameters: items
    }));
  });

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

  readonly validationErrors = computed<readonly string[]>(() => {
    const errors: string[] = [];
    for (const descriptor of this.templateParameters()) {
      const err = this.descriptorError(descriptor);
      if (err) errors.push(`${descriptor.name}: ${err}`);
    }
    for (const state of this.invariantStates()) {
      if (state.violated) {
        errors.push(
          state.invariant.message
            || `${this.i18n.text('parameterInvariantViolated')} ${state.invariant.code}`
        );
      }
    }
    return errors;
  });

  constructor() {
    effect(() => {
      this.validationErrorsChanged.emit(this.validationErrors());
    });
  }

  violatedInvariantsFor(paramName: string) {
    return this.invariantStates().filter(
      state => state.violated && state.parameterNames.has(paramName)
    );
  }

  isFieldInvalid(descriptor: DecisionParameterDescriptor): boolean {
    return Boolean(this.descriptorError(descriptor) || this.violatedInvariantsFor(descriptor.name).length > 0);
  }

  describedByIds(descriptor: DecisionParameterDescriptor): string | null {
    const ids: string[] = [];
    if (descriptor.description) ids.push(`param-help-${descriptor.name}`);
    if (descriptor.legalBasis) ids.push(`param-legal-${descriptor.name}`);
    if (
      (descriptor.minimum !== null && descriptor.minimum !== undefined)
      || (descriptor.maximum !== null && descriptor.maximum !== undefined)
    ) {
      ids.push(`param-bounds-${descriptor.name}`);
    }
    if (this.descriptorError(descriptor)) ids.push(`param-error-${descriptor.name}`);
    for (const state of this.violatedInvariantsFor(descriptor.name)) {
      ids.push(`parameter-invariant-${state.invariant.code}`);
    }
    return ids.length ? ids.join(' ') : null;
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

  protected localizedUnit(unit: string | null | undefined): string {
    return localizeGenericUnit(unit, this.i18n.locale());
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
