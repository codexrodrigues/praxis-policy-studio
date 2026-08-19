import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PolicyStudioI18n } from '../../core/i18n';
import type { DecisionFact } from './catalog.fixture';
import { ScenarioFactsEditorComponent, type ScenarioFactNullChange, type ScenarioFactValueChange } from './scenario-facts-editor.component';

export interface ScenarioCreateView {
  readonly key: string;
  readonly name: string;
  readonly factsJson: string;
  readonly expectedDecision: string;
  readonly expectedOutputJson: string;
  readonly expectedReasonCodes: string;
  readonly expectedEffectIntents: string;
  readonly form: HTMLFormElement;
}

@Component({
  selector: 'pax-scenario-create-form',
  imports: [FormsModule, ScenarioFactsEditorComponent],
  templateUrl: './scenario-create-form.component.html',
  styleUrl: './scenario-create-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScenarioCreateFormComponent {
  readonly facts = input.required<readonly DecisionFact[]>();
  readonly factValues = input.required<Readonly<Record<string, unknown>>>();
  readonly factsJson = input.required<string>();
  readonly fallbackJson = input.required<string>();
  readonly busy = input(false);
  readonly canManage = input(false);

  readonly factValueChanged = output<ScenarioFactValueChange>();
  readonly factNullChanged = output<ScenarioFactNullChange>();
  readonly fallbackJsonChanged = output<string>();
  readonly createRequested = output<ScenarioCreateView>();
  readonly i18n = inject(PolicyStudioI18n);

  outcome(outcome: string): string {
    const key = ({
      ALLOW: 'outcomeAllow', DENY: 'outcomeDeny', NOT_APPLICABLE: 'outcomeNotApplicable',
      INCONCLUSIVE: 'outcomeInconclusive', TECHNICAL_ERROR: 'outcomeTechnicalError'
    } as const)[outcome.toUpperCase() as 'ALLOW'];
    return key ? this.i18n.text(key) : this.i18n.text('outcomeUnknown');
  }
}
