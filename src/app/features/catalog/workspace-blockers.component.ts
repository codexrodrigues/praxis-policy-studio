import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import type { DomainRuleWorkspaceCapabilities } from '@praxisui/core';
import { PolicyStudioI18n } from '../../core/i18n';

@Component({
  selector: 'pax-workspace-blockers',
  template: `
    @for (blocker of capabilities().blockers; track blocker.code + blocker.action) {
      <p class="authority-note">{{ label(blocker.code) }}</p>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkspaceBlockersComponent {
  readonly capabilities = input.required<DomainRuleWorkspaceCapabilities>();
  readonly i18n = inject(PolicyStudioI18n);

  label(code: string): string {
    switch (code) {
      case 'CURRENT_PASSING_TEST_RUN_REQUIRED': return this.i18n.text('workspaceBlockerCurrentTestRequired');
      case 'TEST_RUN_DOES_NOT_PROVE_CURRENT_REVISION': return this.i18n.text('workspaceBlockerCurrentRevisionRequired');
      case 'ACTIVE_SCENARIO_REQUIRED': return this.i18n.text('workspaceBlockerActiveScenarioRequired');
      case 'ACTIVE_SCENARIO_COVERAGE_INCOMPLETE': return this.i18n.text('workspaceBlockerCoverageIncomplete');
      case 'TEST_RUN_NOT_PASSING': return this.i18n.text('workspaceBlockerTestNotPassing');
      case 'BOUND_TEST_RUN_REQUIRED': return this.i18n.text('snapshotBlockerBoundTestRunRequired');
      case 'REQUIRED_BASELINE_AUTHORITY_MISSING': return this.i18n.text('snapshotBlockerBaselineAuthorityMissing');
      case 'REQUIRED_BASELINE_ELIGIBILITY_MISSING': return this.i18n.text('snapshotBlockerBaselineEligibilityMissing');
      case 'CLEANUP_EVIDENCE_INCOMPLETE': return this.i18n.text('snapshotBlockerCleanupIncomplete');
      case 'BASELINE_PARITY_INCOMPLETE': return this.i18n.text('snapshotBlockerBaselineParityIncomplete');
      case 'OPERATION_DECISION_MATRIX_INCOMPLETE': return this.i18n.text('snapshotBlockerOperationMatrixIncomplete');
      case 'REVIEWED_TEST_RUN_PROVENANCE_AMBIGUOUS': return this.i18n.text('snapshotBlockerProvenanceAmbiguous');
      case 'TEST_EVIDENCE_POLICY_INVALID': return this.i18n.text('snapshotBlockerPolicyInvalid');
      case 'TEST_EVIDENCE_GATE_UNAVAILABLE': return this.i18n.text('snapshotBlockerGateUnavailable');
      default: return this.i18n.text('snapshotBlockerUnknown');
    }
  }
}
