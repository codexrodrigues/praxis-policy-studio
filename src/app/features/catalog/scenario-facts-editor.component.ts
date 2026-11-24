import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import {
  formatFactDisplayLabel,
  splitFactDescriptionAndHint,
  type SplitFactDescription
} from '../../core/fact-presentation';
import { PolicyStudioI18n } from '../../core/i18n';
import type { StudioViewDepth } from '../../core/studio-shell-state.service';
import type { DecisionFact } from './catalog.fixture';

export interface ScenarioFactValueChange {
  readonly fact: DecisionFact;
  readonly value: string | boolean;
}

export interface ScenarioFactNullChange {
  readonly fact: DecisionFact;
  readonly useNull: boolean;
}

export interface PartitionedScenarioFacts {
  readonly primary: readonly DecisionFact[];
  readonly other: readonly DecisionFact[];
}

function normalizeFactComparisonPath(path: string): string {
  return path.trim().replace(/:/g, '.').toLowerCase();
}

@Component({
  selector: 'pax-scenario-facts-editor',
  imports: [NgTemplateOutlet],
  templateUrl: './scenario-facts-editor.component.html',
  styleUrl: './scenario-facts-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScenarioFactsEditorComponent {
  readonly facts = input.required<readonly DecisionFact[]>();
  readonly values = input.required<Readonly<Record<string, unknown>>>();
  readonly preview = input<string | null>(null);
  readonly viewDepth = input<StudioViewDepth>('business');
  readonly primaryFactPaths = input<readonly string[]>([]);
  readonly valueChanged = output<ScenarioFactValueChange>();
  readonly nullChanged = output<ScenarioFactNullChange>();
  readonly i18n = inject(PolicyStudioI18n);

  readonly partitionedFacts = computed<PartitionedScenarioFacts>(() => {
    const allFacts = this.facts();
    const primaryRefs = this.primaryFactPaths()
      .map(normalizeFactComparisonPath)
      .filter(Boolean);
    if (allFacts.length === 0 || primaryRefs.length === 0) {
      return { primary: allFacts, other: [] };
    }

    const primary: DecisionFact[] = [];
    const other: DecisionFact[] = [];
    for (const fact of allFacts) {
      const normalized = normalizeFactComparisonPath(fact.path);
      const matchesRule = primaryRefs.some(ref =>
        normalized === ref
        || normalized.startsWith(`${ref}.`)
        || ref.startsWith(`${normalized}.`)
      );
      // Keep non-nullable facts visible so native form constraints stay focusable.
      if (matchesRule || !fact.nullable) {
        primary.push(fact);
      } else {
        other.push(fact);
      }
    }

    if (primary.length === 0 || other.length === 0) {
      return { primary: allFacts, other: [] };
    }
    return { primary, other };
  });

  isNull(path: string): boolean {
    return this.values()[path] === null;
  }

  displayValue(path: string): string {
    const value = this.values()[path];
    return Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value);
  }

  factLabel(fact: Pick<DecisionFact, 'label' | 'path'>): string {
    return formatFactDisplayLabel(fact, this.i18n.locale(), this.viewDepth(), true);
  }

  factDescription(fact: Pick<DecisionFact, 'description' | 'hint'>): SplitFactDescription {
    return splitFactDescriptionAndHint(fact.description, fact.hint);
  }
}
