import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import type { DomainRuleParameterDescriptor } from '@praxisui/core';
import { PolicyStudioI18n } from '../../core/i18n';
import type { ParameterError, RuleParameterDraft, RuleParameterDrafts } from './rule-parameter-draft';

@Component({
  selector: 'pax-rule-parameters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="rule-parameters-title">
      <p class="parameter-title" id="rule-parameters-title">{{ i18n.text('ruleParameters') }}</p>
      <p>{{ i18n.text('ruleParametersBoundary') }}</p>
      <div class="parameter-grid">
        @for (parameter of parameters(); track parameter.name; let index = $index) {
          @let draft = drafts()[parameter.name];
          <fieldset [disabled]="disabled() || parameter.readOnly">
            <legend>{{ parameter.name }} @if (parameter.unit) { <small>({{ parameter.unit }})</small> }</legend>
            <label [for]="'parameter-mode-' + index">{{ i18n.text('parameterSource') }}</label>
            <select [id]="'parameter-mode-' + index" [value]="draft?.mode ?? 'DEFAULT'"
              [attr.aria-invalid]="!!errors()[parameter.name]" [attr.aria-describedby]="'parameter-hint-' + index"
              (change)="changeMode(parameter.name, $any($event.target).value)">
              <option value="DEFAULT">{{ i18n.text('parameterUseDefault') }}</option>
              <option value="VALUE">{{ i18n.text('parameterDeclared') }}</option>
              @if (parameter.nullable) { <option value="NULL">{{ i18n.text('parameterExplicitNull') }}</option> }
            </select>
            @if (draft?.mode === 'VALUE') {
              <label [for]="'parameter-value-' + index">{{ i18n.text('parameterValue') }}</label>
              @if (parameter.allowedValues?.length) {
                <select [id]="'parameter-value-' + index" [value]="draft?.text ?? ''"
                  [attr.aria-invalid]="!!errors()[parameter.name]"
                  [attr.aria-describedby]="'parameter-hint-' + index"
                  (change)="changeText(parameter.name, $any($event.target).value)">
                  @for (value of parameter.allowedValues; track $index) {
                    @if (value !== null) { <option [value]="scalarText(value)">{{ text(value) }}</option> }
                  }
                </select>
              } @else if (parameter.type === 'BOOLEAN') {
                <select [id]="'parameter-value-' + index" [value]="draft?.text ?? ''"
                  [attr.aria-invalid]="!!errors()[parameter.name]"
                  [attr.aria-describedby]="'parameter-hint-' + index"
                  (change)="changeText(parameter.name, $any($event.target).value)">
                  <option value="" disabled>{{ i18n.text('parameterChooseValue') }}</option>
                  <option value="true">{{ i18n.text('parameterTrue') }}</option>
                  <option value="false">{{ i18n.text('parameterFalse') }}</option>
                </select>
              } @else {
                <input [id]="'parameter-value-' + index" [type]="parameter.type === 'STRING' ? 'text' : 'number'"
                  [value]="draft?.text ?? ''" [attr.min]="parameter.minimum"
                  [attr.max]="parameter.maximum" [attr.step]="parameter.type === 'INTEGER' ? 1 : 'any'"
                  [attr.aria-invalid]="!!errors()[parameter.name]"
                  [attr.aria-describedby]="'parameter-hint-' + index"
                  (input)="changeText(parameter.name, $any($event.target).value)" />
              }
            }
            <div [id]="'parameter-hint-' + index" class="parameter-hint" aria-live="polite">
              <small>{{ i18n.text('parameterDefault') }}: {{ text(parameter.defaultValue) }}</small>
              <small>{{ i18n.text('parameterEffective') }}: {{ text(parameter.effectiveValue) }}</small>
              @if (parameter.minimum != null) { <small>{{ i18n.text('parameterMinimum') }}: {{ parameter.minimum }}</small> }
              @if (parameter.maximum != null) { <small>{{ i18n.text('parameterMaximum') }}: {{ parameter.maximum }}</small> }
              @if (parameter.readOnly) { <small>{{ i18n.text('parameterReadOnly') }}</small> }
              @if (errors()[parameter.name]; as error) { <strong role="alert">{{ i18n.text(error) }}</strong> }
            </div>
          </fieldset>
        }
      </div>
    </section>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .parameter-title { margin: 0 0 .5rem; font-weight: 750; } p { line-height: 1.5; }
    .parameter-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); gap: 1rem; }
    fieldset { min-width: 0; margin: 0; padding: 1rem; border: 1px solid var(--pax-color-outline-variant, #c5d0d5); border-radius: .75rem; }
    legend { max-width: 100%; overflow-wrap: anywhere; font-weight: 650; }
    label { display: block; margin: .6rem 0 .3rem; }
    input, select { box-sizing: border-box; width: 100%; min-height: 2.75rem; padding: .5rem; font: inherit; color: inherit; background: var(--pax-color-surface-container-lowest, #ffffff); border: 1px solid var(--pax-color-outline, #697a82); border-radius: .4rem; }
    input:focus-visible, select:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
    .parameter-hint { display: grid; gap: .35rem; margin-top: .7rem; overflow-wrap: anywhere; }
    .parameter-hint strong { color: var(--pax-color-error, #ba1a1a); }
    fieldset:disabled { opacity: .8; }
  `
})
export class RuleParametersComponent {
  readonly i18n = inject(PolicyStudioI18n);
  readonly parameters = input.required<readonly DomainRuleParameterDescriptor[]>();
  readonly drafts = input.required<RuleParameterDrafts>();
  readonly errors = input.required<Readonly<Record<string, ParameterError>>>();
  readonly disabled = input(false);
  readonly draftChange = output<{ name: string; draft: RuleParameterDraft }>();

  changeMode(name: string, mode: RuleParameterDraft['mode']): void {
    const parameter = this.parameters().find(item => item.name === name);
    if (this.disabled() || !parameter || parameter.readOnly || (mode === 'NULL' && !parameter.nullable)) return;
    this.draftChange.emit({ name, draft: { mode, text: this.drafts()[name]?.text ?? '' } });
  }
  changeText(name: string, text: string): void {
    const parameter = this.parameters().find(item => item.name === name);
    if (this.disabled() || !parameter || parameter.readOnly) return;
    this.draftChange.emit({ name, draft: { mode: 'VALUE', text } });
  }
  scalarText(value: unknown): string { return String(value); }
  text(value: unknown): string {
    return value === undefined ? '—' : value === null ? this.i18n.text('parameterExplicitNull')
      : value === '' ? this.i18n.text('parameterEmptyString') : String(value);
  }
}
