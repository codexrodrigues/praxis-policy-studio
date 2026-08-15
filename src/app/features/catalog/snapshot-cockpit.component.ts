import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import type {
  DomainRuleDecision,
  DomainRuleExecutionSummary,
  DomainRuleHostStatusSummary,
  DomainRuleRolloutEnforcementMode,
  DomainRuleRolloutPolicy,
  DomainRuleRolloutPolicyCatalog,
  DomainRuleRolloutPolicyCreateRequest,
  DomainRuleRolloutPolicyEvent,
  DomainRuleRolloutCatalog,
  DomainRuleRolloutCatalogItem,
  DomainRuleSnapshotHeadStatus,
  DomainRuleSnapshotVersion
} from '@praxisui/core';
import { PolicyStudioI18n } from '../../core/i18n';

@Component({
  selector: 'pax-snapshot-cockpit',
  templateUrl: './snapshot-cockpit.component.html',
  styleUrl: './snapshot-cockpit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SnapshotCockpitComponent {
  readonly ruleSetKey = input.required<string>();
  readonly head = input<DomainRuleSnapshotHeadStatus | null>(null);
  readonly versions = input<readonly DomainRuleSnapshotVersion[]>([]);
  readonly loading = input(false);
  readonly loadError = input(false);
  readonly busy = input(false);
  readonly feedback = input<string | null>(null);
  readonly feedbackError = input(false);
  readonly executionSummary = input<DomainRuleExecutionSummary | null>(null);
  readonly executionSummaryLoading = input(false);
  readonly executionSummaryError = input<'authentication' | 'forbidden' | 'failed' | null>(null);
  readonly hostStatusSummary = input<DomainRuleHostStatusSummary | null>(null);
  readonly hostStatusLoading = input(false);
  readonly hostStatusError = input<'authentication' | 'forbidden' | 'failed' | null>(null);
  readonly rolloutPolicyCatalog = input<DomainRuleRolloutPolicyCatalog | null>(null);
  readonly rolloutPolicyTimeline = input<readonly DomainRuleRolloutPolicyEvent[]>([]);
  readonly rolloutPoliciesLoading = input(false);
  readonly rolloutPoliciesError = input<'missing' | 'authentication' | 'forbidden' | 'failed' | null>(null);
  readonly rolloutPolicyBusy = input(false);
  readonly rolloutPolicyFeedback = input<string | null>(null);
  readonly rolloutPolicyFeedbackError = input(false);
  readonly rolloutCatalog = input<DomainRuleRolloutCatalog | null>(null);
  readonly rolloutLoading = input(false);
  readonly rolloutError = input(false);
  readonly rolloutBusy = input(false);
  readonly rolloutFeedback = input<string | null>(null);
  readonly rolloutFeedbackError = input(false);
  readonly retry = output<void>();
  readonly retryExecutionSummary = output<void>();
  readonly retryHostStatus = output<void>();
  readonly operate = output<DomainRuleSnapshotVersion>();
  readonly retryRolloutPolicies = output<void>();
  readonly createRolloutPolicy = output<DomainRuleRolloutPolicyCreateRequest>();
  readonly approveRolloutPolicy = output<DomainRuleRolloutPolicy>();
  readonly activateRolloutPolicy = output<DomainRuleRolloutPolicy>();
  readonly retryRollouts = output<void>();
  readonly createRollout = output<string>();
  readonly cancelRollout = output<DomainRuleRolloutCatalogItem>();
  readonly activateRollout = output<DomainRuleRolloutCatalogItem>();
  readonly i18n = inject(PolicyStudioI18n);
  readonly policyAuthoringOpen = signal(false);
  readonly policyInputError = signal(false);
  readonly outcomes: readonly DomainRuleDecision[] = [
    'ALLOW', 'DENY', 'NOT_APPLICABLE', 'INCONCLUSIVE', 'TECHNICAL_ERROR'
  ];

  actionLabel(version: DomainRuleSnapshotVersion): string {
    if (version.availableAction === 'ACTIVATE') return this.i18n.text('activateSnapshot');
    if (version.availableAction === 'ROLLBACK') return this.i18n.text('rollbackSnapshot');
    if (version.availableAction === 'ACTIVE') return this.i18n.text('activeSnapshot');
    return this.i18n.text('snapshotUnavailable');
  }

  policyActionLabel(policy: DomainRuleRolloutPolicy): string {
    if (policy.availableActions.includes('APPROVE')) return this.i18n.text('approveRolloutPolicy');
    if (policy.availableActions.includes('ACTIVATE')) return this.i18n.text('activateRolloutPolicy');
    return policy.status;
  }

  canCreateRollout(version: DomainRuleSnapshotVersion): boolean {
    return !version.active
      && (this.rolloutCatalog()?.availableActions.includes('CREATE_ROLLOUT') ?? false);
  }

  submitPolicy(
    policyKey: string,
    enforcementMode: string,
    minimumFreshProbes: string,
    minimumReadyRatio: string,
    blockOnIncompatible: boolean,
    staleAfterSeconds: string,
    maximumRolloutAgeSeconds: string
  ): void {
    const probes = Number(minimumFreshProbes);
    const ratio = Number(minimumReadyRatio);
    const stale = Number(staleAfterSeconds);
    const maximumAge = maximumRolloutAgeSeconds.trim() ? Number(maximumRolloutAgeSeconds) : null;
    const mode = enforcementMode as DomainRuleRolloutEnforcementMode;
    const invalid = !policyKey.trim() || !['OBSERVE_ONLY', 'REQUIRED'].includes(mode)
      || !Number.isInteger(probes) || probes < 0 || !Number.isFinite(ratio) || ratio < 0 || ratio > 1
      || !Number.isInteger(stale) || stale < 1
      || (maximumAge !== null && (!Number.isInteger(maximumAge) || maximumAge < 1))
      || (mode === 'REQUIRED' && (probes < 1 || ratio <= 0));
    this.policyInputError.set(invalid);
    if (invalid) return;
    this.createRolloutPolicy.emit({
      ruleSetKey: this.ruleSetKey(),
      policyKey: policyKey.trim(),
      enforcementMode: mode,
      minimumFreshProbes: probes,
      minimumReadyRatio: ratio,
      blockOnIncompatible,
      staleAfterSeconds: stale,
      maximumRolloutAgeSeconds: maximumAge
    });
  }
}
