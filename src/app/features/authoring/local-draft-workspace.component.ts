import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RuleEditorComponent, type RuleBuilderConfig, type RuleBuilderState } from '@praxisui/visual-builder';

@Component({
  selector: 'pax-local-draft-workspace',
  imports: [RuleEditorComponent],
  template: `
    <praxis-rule-editor
      [embedded]="true"
      mode="condition"
      [config]="config()"
      [initialCondition]="$any(condition())"
      (conditionChanged)="conditionChanged.emit($event)"
      (stateChanged)="stateChanged.emit($event)" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LocalDraftWorkspaceComponent {
  readonly config = input.required<RuleBuilderConfig>();
  readonly condition = input.required<unknown>();
  readonly conditionChanged = output<unknown>();
  readonly stateChanged = output<RuleBuilderState>();
}
