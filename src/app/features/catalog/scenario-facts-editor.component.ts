import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { PolicyStudioI18n } from '../../core/i18n';
import type { DecisionFact } from './catalog.fixture';

export interface ScenarioFactValueChange {
  readonly fact: DecisionFact;
  readonly value: string | boolean;
}

export interface ScenarioFactNullChange {
  readonly fact: DecisionFact;
  readonly useNull: boolean;
}

@Component({
  selector: 'pax-scenario-facts-editor',
  templateUrl: './scenario-facts-editor.component.html',
  styleUrl: './scenario-facts-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScenarioFactsEditorComponent {
  readonly facts = input.required<readonly DecisionFact[]>();
  readonly values = input.required<Readonly<Record<string, unknown>>>();
  readonly preview = input<string | null>(null);
  readonly valueChanged = output<ScenarioFactValueChange>();
  readonly nullChanged = output<ScenarioFactNullChange>();
  readonly i18n = inject(PolicyStudioI18n);

  isNull(path: string): boolean {
    return this.values()[path] === null;
  }

  displayValue(path: string): string {
    const value = this.values()[path];
    return Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value);
  }
}
