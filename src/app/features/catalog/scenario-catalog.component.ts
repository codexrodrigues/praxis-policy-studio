import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import type { DomainRuleTestScenario } from '@praxisui/core';
import { PolicyStudioI18n } from '../../core/i18n';
import type { DecisionFact } from './catalog.fixture';
import { ScenarioFactsEditorComponent, type ScenarioFactNullChange, type ScenarioFactValueChange } from './scenario-facts-editor.component';

export interface ScenarioUpdateView {
  readonly scenario: DomainRuleTestScenario;
  readonly key: string;
  readonly name: string;
  readonly factsJson: string;
  readonly expectedDecision: string;
  readonly status: string;
  readonly expectedOutputJson: string;
  readonly expectedReasonCodes: string;
  readonly expectedEffectIntents: string;
}

export interface ScenarioOperationModeView {
  readonly scenarioId: string;
  readonly mode: string;
}

@Component({
  selector: 'pax-scenario-catalog',
  imports: [ScenarioFactsEditorComponent],
  templateUrl: './scenario-catalog.component.html',
  styleUrl: './scenario-catalog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScenarioCatalogComponent {
  readonly scenarios = input.required<readonly DomainRuleTestScenario[]>();
  readonly facts = input.required<readonly DecisionFact[]>();
  readonly editingScenarioId = input<string | null>(null);
  readonly editingFactValues = input.required<Readonly<Record<string, unknown>>>();
  readonly editingFactsJson = input.required<string>();
  readonly busy = input(false);
  readonly canManage = input(false);
  readonly operationalModeEnabled = input(false);
  readonly operationalModes = input.required<Readonly<Record<string, 'CREATE' | 'UPDATE' | ''>>>();

  readonly editRequested = output<string>();
  readonly cancelRequested = output<void>();
  readonly editDirty = output<void>();
  readonly factValueChanged = output<ScenarioFactValueChange>();
  readonly factNullChanged = output<ScenarioFactNullChange>();
  readonly updateRequested = output<ScenarioUpdateView>();
  readonly operationModeChanged = output<ScenarioOperationModeView>();
  readonly i18n = inject(PolicyStudioI18n);

  outcome(outcome: string): string {
    const key = ({
      ALLOW: 'outcomeAllow', DENY: 'outcomeDeny', NOT_APPLICABLE: 'outcomeNotApplicable',
      INCONCLUSIVE: 'outcomeInconclusive', TECHNICAL_ERROR: 'outcomeTechnicalError'
    } as const)[outcome.toUpperCase() as 'ALLOW'];
    return key ? this.i18n.text(key) : this.i18n.text('outcomeUnknown');
  }

  status(status: string): string {
    return status.toUpperCase() === 'ACTIVE' ? this.i18n.text('scenarioActiveLabel')
      : status.toUpperCase() === 'DISABLED' ? this.i18n.text('scenarioDisabledLabel')
        : this.i18n.text('statusUnknown');
  }

  expectedOutput(scenario: DomainRuleTestScenario): string {
    return scenario.expectedOutput == null ? '' : JSON.stringify(scenario.expectedOutput, null, 2);
  }

  factsJson(scenario: DomainRuleTestScenario): string {
    return JSON.stringify(scenario.facts, null, 2);
  }

  assertions(values: readonly string[] | undefined): string {
    return values?.join('\n') ?? '';
  }
}
