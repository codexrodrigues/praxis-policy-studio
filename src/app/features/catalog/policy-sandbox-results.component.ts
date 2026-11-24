import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { PolicyStudioI18n } from '../../core/i18n';
import type { PolicySandboxRun, PolicySandboxScenarioResult } from './catalog.fixture';

export interface SandboxSummaryCounts {
  readonly total: number;
  readonly passed: number;
  readonly diverged: number;
}

@Component({
  selector: 'pax-policy-sandbox-results',
  template: `
    @if (run(); as current) {
      <div class="sandbox-results" aria-live="polite">
        @if (summary(); as counts) {
          @if (counts.total > 0) {
            <div class="sandbox-summary-strip" data-testid="sandbox-summary-strip">
              <span class="pax-status-pill pax-status-pill--success">
                {{ i18n.format('sandboxSummaryPassed', { count: counts.passed }) }}
              </span>
              <span
                class="pax-status-pill"
                [class.pax-status-pill--danger]="counts.diverged > 0"
                [class.pax-status-pill--neutral]="counts.diverged === 0">
                {{ i18n.format('sandboxSummaryDiverged', { count: counts.diverged }) }}
              </span>
              <span class="pax-status-pill pax-status-pill--neutral">
                {{ i18n.format('sandboxSummaryTotal', { count: counts.total }) }}
              </span>
            </div>
          }
        }
        @for (result of current.results; track result.scenarioId) {
          @let isPassed = passed(result);
          <article [class.passed]="isPassed">
            <div class="sandbox-result-head">
              <strong>{{ result.scenarioKey }}</strong>
              <span
                class="pax-status-pill"
                [class.pax-status-pill--success]="isPassed"
                [class.pax-status-pill--danger]="!isPassed">
                {{ i18n.text(isPassed ? 'sandboxStatusPassed' : 'sandboxStatusDiverged') }}
              </span>
            </div>
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

  readonly summary = computed<SandboxSummaryCounts>(() => {
    const items = this.run()?.results ?? [];
    const passed = items.filter(result => this.passed(result)).length;
    return {
      total: items.length,
      passed,
      diverged: items.length - passed
    };
  });

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
