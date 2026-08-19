import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { PolicyStudioI18n } from '../../core/i18n';
import type { PolicySandboxRun, PolicySandboxScenarioResult } from './catalog.fixture';

@Component({
  selector: 'pax-policy-sandbox-results',
  template: `
    @if (run(); as current) {
      <div class="sandbox-results" aria-live="polite">
        @for (result of current.results; track result.scenarioId) {
          <article [class.passed]="passed(result)">
            <strong>{{ result.scenarioKey }}</strong>
            <span>{{ outcome(result.candidateDecision) }} / {{ outcome(result.expectedDecision) }}</span>
            <small>{{ comparison(result.comparison) }} · {{ i18n.text('activeVersion') }} {{ outcome(result.activeDecision) }}</small>
          </article>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PolicySandboxResultsComponent {
  readonly run = input<PolicySandboxRun | null>(null);
  readonly i18n = inject(PolicyStudioI18n);

  outcome(decision: string): string {
    const key = ({
      ALLOW: 'outcomeAllow', DENY: 'outcomeDeny', NOT_APPLICABLE: 'outcomeNotApplicable',
      INCONCLUSIVE: 'outcomeInconclusive', TECHNICAL_ERROR: 'outcomeTechnicalError'
    } as const)[decision.toUpperCase() as 'ALLOW'];
    return key ? this.i18n.text(key) : this.i18n.text('outcomeUnknown');
  }

  comparison(value: string): string {
    const normalized = value.toUpperCase();
    return normalized.includes('MATCH') && !normalized.includes('MISMATCH')
      ? this.i18n.text('comparisonMatch')
      : normalized.includes('MISMATCH') ? this.i18n.text('comparisonMismatch')
        : this.i18n.text('comparisonUnavailable');
  }

  passed(result: PolicySandboxScenarioResult): boolean {
    return result.candidateDecision !== 'TECHNICAL_ERROR'
      && result.activeDecision !== 'TECHNICAL_ERROR'
      && result.candidateMatchesExpected
      && result.activeMatchesExpected
      && this.comparison(result.comparison) === this.i18n.text('comparisonMatch');
  }
}
