import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import {
  isDomainRuleSnapshotProblemResponse,
  type DomainRuleCompositionApproval,
  type DomainRuleExecutionSummary,
  type DomainRuleHostStatusSummary,
  type DomainRuleRolloutCatalog,
  type DomainRuleRolloutCatalogItem,
  type DomainRuleRolloutPolicy,
  type DomainRuleRolloutPolicyCatalog,
  type DomainRuleRolloutPolicyCreateRequest,
  type DomainRuleRolloutPolicyEvent,
  type DomainRuleSnapshotBlocker,
  type DomainRuleSnapshotHeadStatus,
  type DomainRuleSnapshotVersion
} from '@praxisui/core';
import { forkJoin } from 'rxjs';
import { PolicyStudioI18n } from '../../core/i18n';
import { ProjectionCatalogService } from '../../core/projection-catalog.service';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import type {
  RuleSetCompositionCandidate,
  RuleSetCompositionCandidateCommand,
  RuleSetCompositionCandidateRequest,
  RuleSetCompositionPublication
} from './catalog.fixture';
import { CatalogSelectionStore } from './catalog-selection.store';

@Injectable()
export class SnapshotExecutionFacade {
  private readonly store = inject(CatalogSelectionStore);
  private readonly catalog = inject(ProjectionCatalogService);
  private readonly runtime = inject(RuntimeConfigService);
  private readonly i18n = inject(PolicyStudioI18n);

  readonly snapshotHead = signal<DomainRuleSnapshotHeadStatus | null>(null);
  readonly snapshotVersions = signal<readonly DomainRuleSnapshotVersion[]>([]);
  readonly snapshotsLoading = signal(false);
  readonly snapshotsError = signal(false);
  readonly snapshotBusy = signal(false);
  readonly snapshotFeedback = signal<string | null>(null);
  readonly snapshotFeedbackError = signal(false);
  readonly snapshotBlockers = signal<readonly DomainRuleSnapshotBlocker[]>([]);

  readonly executionSummary = signal<DomainRuleExecutionSummary | null>(null);
  readonly executionSummaryLoading = signal(false);
  readonly executionSummaryError = signal<'authentication' | 'forbidden' | 'failed' | null>(null);

  readonly hostStatusSummary = signal<DomainRuleHostStatusSummary | null>(null);
  readonly hostStatusLoading = signal(false);
  readonly hostStatusError = signal<'authentication' | 'forbidden' | 'failed' | null>(null);

  readonly rolloutPolicyCatalog = signal<DomainRuleRolloutPolicyCatalog | null>(null);
  readonly rolloutPolicyTimeline = signal<readonly DomainRuleRolloutPolicyEvent[]>([]);
  readonly rolloutPoliciesLoading = signal(false);
  readonly rolloutPoliciesError = signal<'missing' | 'authentication' | 'forbidden' | 'failed' | null>(null);
  readonly rolloutPolicyBusy = signal(false);
  readonly rolloutPolicyFeedback = signal<string | null>(null);
  readonly rolloutPolicyFeedbackError = signal(false);

  readonly rolloutCatalog = signal<DomainRuleRolloutCatalog | null>(null);
  readonly rolloutLoading = signal(false);
  readonly rolloutError = signal(false);
  readonly rolloutBusy = signal(false);
  readonly rolloutFeedback = signal<string | null>(null);
  readonly rolloutFeedbackError = signal(false);

  readonly compositionCandidate = signal<RuleSetCompositionCandidate | null>(null);
  readonly compositionApproval = signal<DomainRuleCompositionApproval | null>(null);
  readonly compositionPublication = signal<RuleSetCompositionPublication | null>(null);

  private snapshotLoadRevision = 0;
  private rolloutPolicyLoadRevision = 0;
  private rolloutLoadRevision = 0;
  private hostStatusLoadRevision = 0;
  private executionSummaryLoadRevision = 0;

  resetForSelection(): void {
    this.snapshotFeedback.set(null);
    this.snapshotFeedbackError.set(false);
    this.snapshotBlockers.set([]);
    this.rolloutPolicyFeedback.set(null);
    this.rolloutPolicyFeedbackError.set(false);
    this.rolloutFeedback.set(null);
    this.rolloutFeedbackError.set(false);
    this.compositionCandidate.set(null);
    this.compositionApproval.set(null);
    this.compositionPublication.set(null);
  }

  clearAll(): void {
    ++this.snapshotLoadRevision;
    ++this.rolloutPolicyLoadRevision;
    ++this.rolloutLoadRevision;
    ++this.hostStatusLoadRevision;
    ++this.executionSummaryLoadRevision;
    this.snapshotHead.set(null);
    this.snapshotVersions.set([]);
    this.snapshotsLoading.set(false);
    this.snapshotsError.set(false);
    this.snapshotBusy.set(false);
    this.snapshotFeedback.set(null);
    this.snapshotFeedbackError.set(false);
    this.snapshotBlockers.set([]);
    this.rolloutPolicyCatalog.set(null);
    this.rolloutPolicyTimeline.set([]);
    this.rolloutPoliciesLoading.set(false);
    this.rolloutPoliciesError.set(null);
    this.rolloutPolicyBusy.set(false);
    this.rolloutPolicyFeedback.set(null);
    this.rolloutPolicyFeedbackError.set(false);
    this.rolloutCatalog.set(null);
    this.rolloutLoading.set(false);
    this.rolloutError.set(false);
    this.rolloutBusy.set(false);
    this.rolloutFeedback.set(null);
    this.rolloutFeedbackError.set(false);
    this.hostStatusSummary.set(null);
    this.hostStatusLoading.set(false);
    this.hostStatusError.set(null);
    this.executionSummary.set(null);
    this.executionSummaryLoading.set(false);
    this.executionSummaryError.set(null);
    this.compositionCandidate.set(null);
    this.compositionApproval.set(null);
    this.compositionPublication.set(null);
  }

  loadSnapshots(): void {
    const loadRevision = ++this.snapshotLoadRevision;
    const state = this.runtime.state();
    const ruleSetKey = this.store.selected()?.ruleSetKey;
    this.snapshotHead.set(null);
    this.snapshotVersions.set([]);
    this.snapshotsError.set(false);
    this.loadRolloutPolicies(ruleSetKey ?? null);
    this.loadRollouts(ruleSetKey ?? null);
    if (state.kind !== 'ready' || !ruleSetKey || state.config.mode !== 'remote') {
      this.snapshotsLoading.set(false);
      return;
    }
    this.snapshotsLoading.set(true);
    this.catalog.snapshotCockpit(ruleSetKey, state.config).subscribe({
      next: cockpit => {
        if (loadRevision !== this.snapshotLoadRevision || ruleSetKey !== this.store.selected()?.ruleSetKey) return;
        this.snapshotHead.set(cockpit.head);
        this.snapshotVersions.set(cockpit.versions);
        this.snapshotsLoading.set(false);
        this.loadExecutionSummary(cockpit.head?.activeSnapshotKey ?? null);
        this.loadHostStatusSummary(ruleSetKey);
      },
      error: () => {
        if (loadRevision !== this.snapshotLoadRevision || ruleSetKey !== this.store.selected()?.ruleSetKey) return;
        this.snapshotsLoading.set(false);
        this.snapshotsError.set(true);
      }
    });
  }

  loadRolloutPolicies(
    ruleSetKey: string | null = this.store.selected()?.ruleSetKey ?? null
  ): void {
    const loadRevision = ++this.rolloutPolicyLoadRevision;
    const state = this.runtime.state();
    this.rolloutPolicyCatalog.set(null);
    this.rolloutPolicyTimeline.set([]);
    this.rolloutPoliciesError.set(null);
    if (state.kind !== 'ready' || state.config.mode !== 'remote' || !ruleSetKey) {
      this.rolloutPoliciesLoading.set(false);
      return;
    }
    this.rolloutPoliciesLoading.set(true);
    forkJoin({
      catalog: this.catalog.rolloutPolicyCatalog(ruleSetKey, state.config),
      timeline: this.catalog.rolloutPolicyTimeline(ruleSetKey, state.config)
    }).subscribe({
      next: result => {
        if (loadRevision !== this.rolloutPolicyLoadRevision || ruleSetKey !== this.store.selected()?.ruleSetKey) return;
        this.rolloutPolicyCatalog.set(result.catalog);
        this.rolloutPolicyTimeline.set(result.timeline);
        this.rolloutPoliciesLoading.set(false);
      },
      error: (error: unknown) => {
        if (loadRevision !== this.rolloutPolicyLoadRevision || ruleSetKey !== this.store.selected()?.ruleSetKey) return;
        this.rolloutPoliciesLoading.set(false);
        this.rolloutPoliciesError.set(error instanceof HttpErrorResponse && error.status === 404
          ? 'missing'
          : error instanceof HttpErrorResponse && error.status === 401
            ? 'authentication'
            : error instanceof HttpErrorResponse && error.status === 403 ? 'forbidden' : 'failed');
      }
    });
  }

  loadRollouts(
    ruleSetKey: string | null = this.store.selected()?.ruleSetKey ?? null
  ): void {
    const loadRevision = ++this.rolloutLoadRevision;
    const state = this.runtime.state();
    this.rolloutCatalog.set(null);
    this.rolloutError.set(false);
    if (state.kind !== 'ready' || state.config.mode !== 'remote' || !ruleSetKey) {
      this.rolloutLoading.set(false);
      return;
    }
    this.rolloutLoading.set(true);
    this.catalog.rolloutCatalog(ruleSetKey, state.config).subscribe({
      next: catalog => {
        if (loadRevision !== this.rolloutLoadRevision || ruleSetKey !== this.store.selected()?.ruleSetKey) return;
        this.rolloutCatalog.set(catalog);
        this.rolloutLoading.set(false);
      },
      error: () => {
        if (loadRevision !== this.rolloutLoadRevision || ruleSetKey !== this.store.selected()?.ruleSetKey) return;
        this.rolloutLoading.set(false);
        this.rolloutError.set(true);
      }
    });
  }

  loadHostStatusSummary(
    ruleSetKey: string | null = this.store.selected()?.ruleSetKey ?? null
  ): void {
    const loadRevision = ++this.hostStatusLoadRevision;
    const state = this.runtime.state();
    this.hostStatusSummary.set(null);
    this.hostStatusError.set(null);
    if (state.kind !== 'ready' || state.config.mode !== 'remote' || !ruleSetKey) {
      this.hostStatusLoading.set(false);
      return;
    }
    this.hostStatusLoading.set(true);
    this.catalog.hostStatusSummary(ruleSetKey, state.config).subscribe({
      next: summary => {
        if (loadRevision !== this.hostStatusLoadRevision || ruleSetKey !== this.store.selected()?.ruleSetKey) return;
        this.hostStatusSummary.set(summary);
        this.hostStatusLoading.set(false);
      },
      error: (error: unknown) => {
        if (loadRevision !== this.hostStatusLoadRevision || ruleSetKey !== this.store.selected()?.ruleSetKey) return;
        this.hostStatusLoading.set(false);
        this.hostStatusError.set(error instanceof HttpErrorResponse && error.status === 401
          ? 'authentication'
          : error instanceof HttpErrorResponse && error.status === 403 ? 'forbidden' : 'failed');
      }
    });
  }

  loadExecutionSummary(
    snapshotKey: string | null = this.snapshotHead()?.activeSnapshotKey ?? null
  ): void {
    const loadRevision = ++this.executionSummaryLoadRevision;
    const state = this.runtime.state();
    this.executionSummary.set(null);
    this.executionSummaryError.set(null);
    if (state.kind !== 'ready' || state.config.mode !== 'remote' || !snapshotKey) {
      this.executionSummaryLoading.set(false);
      return;
    }
    this.executionSummaryLoading.set(true);
    this.catalog.executionSummary(snapshotKey, state.config).subscribe({
      next: summary => {
        if (loadRevision !== this.executionSummaryLoadRevision || snapshotKey !== this.snapshotHead()?.activeSnapshotKey) return;
        this.executionSummary.set(summary);
        this.executionSummaryLoading.set(false);
      },
      error: (error: unknown) => {
        if (loadRevision !== this.executionSummaryLoadRevision || snapshotKey !== this.snapshotHead()?.activeSnapshotKey) return;
        this.executionSummaryLoading.set(false);
        this.executionSummaryError.set(error instanceof HttpErrorResponse && error.status === 401
          ? 'authentication'
          : error instanceof HttpErrorResponse && error.status === 403 ? 'forbidden' : 'failed');
      }
    });
  }

  createRolloutPolicy(request: DomainRuleRolloutPolicyCreateRequest): void {
    const state = this.runtime.state();
    if (state.kind !== 'ready' || this.rolloutPolicyBusy()
      || !this.rolloutPolicyCatalog()?.availableActions.includes('CREATE_POLICY_VERSION')) return;
    this.rolloutPolicyBusy.set(true);
    this.rolloutPolicyFeedback.set(null);
    this.rolloutPolicyFeedbackError.set(false);
    const commandRevision = this.store.selectionRevision;
    this.catalog.createRolloutPolicy(request, state.config).subscribe({
      next: () => {
        if (commandRevision !== this.store.selectionRevision) {
          this.rolloutPolicyBusy.set(false);
          return;
        }
        this.rolloutPolicyBusy.set(false);
        this.rolloutPolicyFeedback.set(this.i18n.text('rolloutPolicyCreated'));
        this.loadRolloutPolicies();
      },
      error: error => {
        if (commandRevision !== this.store.selectionRevision) {
          this.rolloutPolicyBusy.set(false);
          return;
        }
        this.failRolloutPolicyOperation(error);
      }
    });
  }

  approveRolloutPolicy(policy: DomainRuleRolloutPolicy): void {
    if (this.runtime.state().kind !== 'ready' || this.rolloutPolicyBusy()
      || !policy.availableActions.includes('APPROVE')) return;
    this.store.openGovernedConfirmation(
      this.i18n.text('confirmRolloutPolicyApproval'),
      `${policy.policyKey} · v${policy.policyVersion}`,
      this.i18n.text('approveRolloutPolicy'),
      () => this.executeApproveRolloutPolicy(policy)
    );
  }

  private executeApproveRolloutPolicy(policy: DomainRuleRolloutPolicy): void {
    const state = this.runtime.state();
    const currentPolicy = this.rolloutPolicyCatalog()?.versions
      .find(item => item.policyId === policy.policyId);
    if (state.kind !== 'ready' || this.rolloutPolicyBusy()
      || !currentPolicy?.availableActions.includes('APPROVE')) return;
    this.rolloutPolicyBusy.set(true);
    this.rolloutPolicyFeedback.set(null);
    this.rolloutPolicyFeedbackError.set(false);
    const commandRevision = this.store.selectionRevision;
    this.catalog.approveRolloutPolicy(currentPolicy, state.config).subscribe({
      next: () => {
        if (commandRevision !== this.store.selectionRevision) {
          this.rolloutPolicyBusy.set(false);
          return;
        }
        this.rolloutPolicyBusy.set(false);
        this.rolloutPolicyFeedback.set(this.i18n.text('rolloutPolicyApproved'));
        this.loadRolloutPolicies();
      },
      error: error => {
        if (commandRevision !== this.store.selectionRevision) {
          this.rolloutPolicyBusy.set(false);
          return;
        }
        this.failRolloutPolicyOperation(error);
      }
    });
  }

  activateRolloutPolicy(policy: DomainRuleRolloutPolicy): void {
    if (this.runtime.state().kind !== 'ready' || !this.rolloutPolicyCatalog()?.headEtag || this.rolloutPolicyBusy()
      || !policy.availableActions.includes('ACTIVATE')) return;
    this.store.openGovernedConfirmation(
      this.i18n.text('confirmRolloutPolicyActivation'),
      `${policy.policyKey} · v${policy.policyVersion}`,
      this.i18n.text('activateRolloutPolicy'),
      () => this.executeActivateRolloutPolicy(policy)
    );
  }

  private executeActivateRolloutPolicy(policy: DomainRuleRolloutPolicy): void {
    const state = this.runtime.state();
    const headEtag = this.rolloutPolicyCatalog()?.headEtag;
    const currentPolicy = this.rolloutPolicyCatalog()?.versions
      .find(item => item.policyId === policy.policyId);
    if (state.kind !== 'ready' || !headEtag || this.rolloutPolicyBusy()
      || !currentPolicy?.availableActions.includes('ACTIVATE')) return;
    this.rolloutPolicyBusy.set(true);
    this.rolloutPolicyFeedback.set(null);
    this.rolloutPolicyFeedbackError.set(false);
    const commandRevision = this.store.selectionRevision;
    try {
      this.catalog.activateRolloutPolicy(currentPolicy, headEtag, state.config).subscribe({
        next: () => {
          if (commandRevision !== this.store.selectionRevision) {
            this.rolloutPolicyBusy.set(false);
            return;
          }
          this.rolloutPolicyBusy.set(false);
          this.rolloutPolicyFeedback.set(this.i18n.text('rolloutPolicyActivated'));
          this.loadRolloutPolicies();
        },
        error: error => {
          if (commandRevision !== this.store.selectionRevision) {
            this.rolloutPolicyBusy.set(false);
            return;
          }
          this.failRolloutPolicyOperation(error);
        }
      });
    } catch (error: unknown) {
      this.failRolloutPolicyOperation(error);
    }
  }

  createRollout(candidateSnapshotKey: string): void {
    if (this.runtime.state().kind !== 'ready' || this.rolloutBusy()
      || !this.canCreateSnapshotRollout(candidateSnapshotKey)) return;
    const expectedHeadEtag = this.snapshotHead()?.headEtag ?? null;
    this.store.openGovernedConfirmation(
      this.i18n.text('confirmStartRollout'),
      candidateSnapshotKey,
      this.i18n.text('startRollout'),
      () => this.executeCreateRollout(candidateSnapshotKey, expectedHeadEtag)
    );
  }

  private canCreateSnapshotRollout(candidateSnapshotKey: string): boolean {
    if (this.snapshotsLoading() || this.snapshotsError()
      || !this.rolloutCatalog()?.availableActions.includes('CREATE_ROLLOUT')) return false;
    const candidate = this.snapshotVersions().find(item => item.snapshotKey === candidateSnapshotKey);
    if (!candidate || candidate.active || candidate.governanceState !== 'READY') return false;
    return this.snapshotHead() === null
      ? candidate.availableAction === 'CREATE_ROLLOUT'
      : !!this.snapshotHead()?.headEtag
        && (candidate.availableAction === 'ACTIVATE' || candidate.availableAction === 'ROLLBACK');
  }

  private executeCreateRollout(candidateSnapshotKey: string, expectedHeadEtag: string | null): void {
    const state = this.runtime.state();
    if (state.kind !== 'ready' || this.rolloutBusy()) return;
    if ((this.snapshotHead()?.headEtag ?? null) !== expectedHeadEtag
      || !this.canCreateSnapshotRollout(candidateSnapshotKey)) {
      this.rolloutFeedbackError.set(true);
      this.rolloutFeedback.set(this.i18n.text('snapshotStateChanged'));
      return;
    }
    this.rolloutBusy.set(true);
    this.clearRolloutFeedback();
    const commandRevision = this.store.selectionRevision;
    try {
      this.catalog.createRollout(candidateSnapshotKey, expectedHeadEtag, state.config).subscribe({
        next: () => {
          if (commandRevision !== this.store.selectionRevision) {
            this.rolloutBusy.set(false);
            return;
          }
          this.rolloutBusy.set(false);
          this.rolloutFeedback.set(this.i18n.text('rolloutStarted'));
          this.loadRollouts();
        },
        error: error => {
          if (commandRevision !== this.store.selectionRevision) {
            this.rolloutBusy.set(false);
            return;
          }
          this.failRolloutOperation(error);
        }
      });
    } catch (error: unknown) {
      this.failRolloutOperation(error);
    }
  }

  cancelRollout(item: DomainRuleRolloutCatalogItem): void {
    if (this.runtime.state().kind !== 'ready' || this.rolloutBusy()
      || !item.availableActions.includes('CANCEL')) return;
    this.store.openGovernedConfirmation(
      this.i18n.text('confirmCancelRollout'),
      item.rollout.candidateSnapshotKey,
      this.i18n.text('cancelRollout'),
      () => this.executeCancelRollout(item)
    );
  }

  private executeCancelRollout(item: DomainRuleRolloutCatalogItem): void {
    const state = this.runtime.state();
    const currentItem = this.rolloutCatalog()?.rollouts
      .find(candidate => candidate.rollout.rolloutId === item.rollout.rolloutId);
    if (state.kind !== 'ready' || this.rolloutBusy()
      || !currentItem?.availableActions.includes('CANCEL')) return;
    this.rolloutBusy.set(true);
    this.clearRolloutFeedback();
    const commandRevision = this.store.selectionRevision;
    this.catalog.cancelRollout(currentItem, state.config).subscribe({
      next: () => {
        if (commandRevision !== this.store.selectionRevision) {
          this.rolloutBusy.set(false);
          return;
        }
        this.rolloutBusy.set(false);
        this.rolloutFeedback.set(this.i18n.text('rolloutCancelled'));
        this.loadRollouts();
      },
      error: error => {
        if (commandRevision !== this.store.selectionRevision) {
          this.rolloutBusy.set(false);
          return;
        }
        this.failRolloutOperation(error);
      }
    });
  }

  activateRollout(item: DomainRuleRolloutCatalogItem): void {
    if (this.runtime.state().kind !== 'ready' || this.rolloutBusy()
      || !item.availableActions.includes('ACTIVATE_CANDIDATE')) return;
    const expectedRollout = { ...item.rollout };
    this.store.openGovernedConfirmation(
      this.i18n.text('confirmPromoteCandidate'),
      item.rollout.candidateSnapshotKey,
      this.i18n.text('promoteCandidate'),
      () => this.executeActivateRollout(expectedRollout)
    );
  }

  private executeActivateRollout(expectedRollout: DomainRuleRolloutCatalogItem['rollout']): void {
    const state = this.runtime.state();
    const currentItem = this.rolloutCatalog()?.rollouts
      .find(candidate => candidate.rollout.rolloutId === expectedRollout.rolloutId);
    if (state.kind !== 'ready' || this.rolloutBusy()) return;
    if (!currentItem?.availableActions.includes('ACTIVATE_CANDIDATE')
      || currentItem.rollout.ruleSetKey !== expectedRollout.ruleSetKey
      || currentItem.rollout.candidateSnapshotKey !== expectedRollout.candidateSnapshotKey
      || currentItem.rollout.candidateContentHash !== expectedRollout.candidateContentHash
      || currentItem.rollout.expectedActiveSnapshotKey !== expectedRollout.expectedActiveSnapshotKey
      || currentItem.rollout.expectedHeadEtag !== expectedRollout.expectedHeadEtag) {
      this.rolloutFeedbackError.set(true);
      this.rolloutFeedback.set(this.i18n.text('snapshotStateChanged'));
      return;
    }
    this.rolloutBusy.set(true);
    this.clearRolloutFeedback();
    const commandRevision = this.store.selectionRevision;
    try {
      this.catalog.activateRolloutCandidate(currentItem, state.config).subscribe({
        next: () => {
          if (commandRevision !== this.store.selectionRevision) {
            this.rolloutBusy.set(false);
            return;
          }
          this.rolloutBusy.set(false);
          this.rolloutFeedback.set(this.i18n.text('candidatePromoted'));
          this.loadSnapshots();
          this.store.loadLifecycle();
        },
        error: error => {
          if (commandRevision !== this.store.selectionRevision) {
            this.rolloutBusy.set(false);
            return;
          }
          this.failRolloutOperation(error);
        }
      });
    } catch (error: unknown) {
      this.failRolloutOperation(error);
    }
  }

  private clearRolloutFeedback(): void {
    this.rolloutFeedback.set(null);
    this.rolloutFeedbackError.set(false);
  }

  private failRolloutOperation(error: unknown): void {
    this.rolloutBusy.set(false);
    this.rolloutFeedbackError.set(true);
    if (error instanceof HttpErrorResponse && error.status === 401) {
      this.store.sessionActive.set(false);
      this.store.authenticationRequired.set(true);
      this.rolloutFeedback.set(this.i18n.text('sessionExpired'));
      return;
    }
    this.rolloutFeedback.set(error instanceof HttpErrorResponse && error.status === 412
      ? this.i18n.text('rolloutHeadStale')
      : error instanceof HttpErrorResponse && error.status === 403
        ? this.i18n.text('governedCommandForbidden')
        : this.i18n.text('rolloutOperationFailed'));
    this.loadRollouts();
  }

  operateSnapshot(version: DomainRuleSnapshotVersion): void {
    if (this.runtime.state().kind !== 'ready' || !this.snapshotHead()?.headEtag || this.snapshotBusy()
      || version.governanceState !== 'READY'
      || (version.availableAction !== 'ACTIVATE' && version.availableAction !== 'ROLLBACK')) return;
    const expectedHeadEtag = this.snapshotHead()!.headEtag;
    const confirmationKey = version.availableAction === 'ROLLBACK'
      ? 'confirmSnapshotRollback'
      : 'confirmSnapshotActivation';
    this.store.openGovernedConfirmation(
      this.i18n.text(confirmationKey),
      version.snapshotKey,
      this.i18n.text(version.availableAction === 'ROLLBACK' ? 'rollbackSnapshot' : 'activateSnapshot'),
      () => this.executeOperateSnapshot(version, expectedHeadEtag)
    );
  }

  private executeOperateSnapshot(version: DomainRuleSnapshotVersion, expectedHeadEtag: string): void {
    const state = this.runtime.state();
    const headEtag = this.snapshotHead()?.headEtag;
    const currentVersion = this.snapshotVersions()
      .find(item => item.snapshotKey === version.snapshotKey);
    if (state.kind !== 'ready' || this.snapshotBusy()) return;
    if (!headEtag || headEtag !== expectedHeadEtag
      || currentVersion?.governanceState !== 'READY'
      || (currentVersion.availableAction !== 'ACTIVATE' && currentVersion.availableAction !== 'ROLLBACK')) {
      this.snapshotFeedbackError.set(true);
      this.snapshotFeedback.set(this.i18n.text('snapshotStateChanged'));
      return;
    }
    this.snapshotBusy.set(true);
    this.snapshotFeedback.set(null);
    this.snapshotFeedbackError.set(false);
    this.snapshotBlockers.set([]);
    const commandRevision = this.store.selectionRevision;
    try {
      this.catalog.operateSnapshot(currentVersion, headEtag, state.config).subscribe({
        next: () => {
          if (commandRevision !== this.store.selectionRevision) {
            this.snapshotBusy.set(false);
            return;
          }
          this.snapshotBusy.set(false);
          this.snapshotFeedbackError.set(false);
          this.snapshotFeedback.set(this.i18n.text(
            currentVersion.availableAction === 'ROLLBACK' ? 'snapshotRolledBack' : 'snapshotActivated'));
          this.loadSnapshots();
          this.store.loadLifecycle();
        },
        error: error => {
          if (commandRevision !== this.store.selectionRevision) {
            this.snapshotBusy.set(false);
            return;
          }
          this.failSnapshotOperation(error);
        }
      });
    } catch (error: unknown) {
      this.failSnapshotOperation(error);
    }
  }

  invalidateSnapshotCompositionDraft(): void {
    this.compositionCandidate.set(null);
    this.compositionApproval.set(null);
    this.compositionPublication.set(null);
  }

  prepareSnapshotComposition(request: RuleSetCompositionCandidateRequest): void {
    const state = this.runtime.state();
    const ruleSetKey = this.store.selected()?.ruleSetKey;
    if (state.kind !== 'ready' || state.config.mode !== 'remote' || !ruleSetKey || this.snapshotBusy()) return;
    this.snapshotBusy.set(true);
    this.snapshotFeedback.set(null);
    this.snapshotFeedbackError.set(false);
    this.snapshotBlockers.set([]);
    const commandRevision = this.store.selectionRevision;
    this.catalog.prepareRuleSetCandidate(ruleSetKey, request, state.config).subscribe({
      next: candidate => {
        if (commandRevision !== this.store.selectionRevision) {
          this.snapshotBusy.set(false);
          return;
        }
        this.snapshotBusy.set(false);
        this.compositionCandidate.set(candidate);
        this.compositionApproval.set(null);
        this.compositionPublication.set(null);
        this.snapshotFeedback.set(this.i18n.text('compositionPrepared'));
      },
      error: error => {
        if (commandRevision !== this.store.selectionRevision) {
          this.snapshotBusy.set(false);
          return;
        }
        this.failSnapshotOperation(error);
      }
    });
  }

  approveSnapshotComposition(command: RuleSetCompositionCandidateCommand): void {
    const state = this.runtime.state();
    const ruleSetKey = this.store.selected()?.ruleSetKey;
    if (state.kind !== 'ready' || state.config.mode !== 'remote' || !ruleSetKey || this.snapshotBusy()) return;
    this.snapshotBusy.set(true);
    this.snapshotFeedback.set(null);
    this.snapshotFeedbackError.set(false);
    this.snapshotBlockers.set([]);
    const commandRevision = this.store.selectionRevision;
    this.catalog.approveRuleSetCandidate(ruleSetKey, command, state.config).subscribe({
      next: approval => {
        if (commandRevision !== this.store.selectionRevision) {
          this.snapshotBusy.set(false);
          return;
        }
        this.snapshotBusy.set(false);
        this.compositionApproval.set(approval);
        this.snapshotFeedback.set(this.i18n.text('compositionApproved'));
      },
      error: error => {
        if (commandRevision !== this.store.selectionRevision) {
          this.snapshotBusy.set(false);
          return;
        }
        this.failSnapshotOperation(error);
      }
    });
  }

  publishSnapshotComposition(command: RuleSetCompositionCandidateCommand): void {
    const state = this.runtime.state();
    const ruleSetKey = this.store.selected()?.ruleSetKey;
    if (state.kind !== 'ready' || state.config.mode !== 'remote' || !ruleSetKey || this.snapshotBusy()) return;
    this.snapshotBusy.set(true);
    this.snapshotFeedback.set(null);
    this.snapshotFeedbackError.set(false);
    this.snapshotBlockers.set([]);
    const commandRevision = this.store.selectionRevision;
    const currentHeadEtag = this.compositionCandidate()?.currentHeadEtag ?? this.snapshotHead()?.headEtag ?? null;
    try {
      this.catalog.publishRuleSetCandidate(ruleSetKey, command, currentHeadEtag, state.config).subscribe({
        next: publication => {
          if (commandRevision !== this.store.selectionRevision) {
            this.snapshotBusy.set(false);
            return;
          }
          this.snapshotBusy.set(false);
          this.compositionPublication.set(publication);
          this.snapshotFeedback.set(this.i18n.text('snapshotPublished'));
          this.loadSnapshots();
          this.store.loadLifecycle();
        },
        error: error => {
          if (commandRevision !== this.store.selectionRevision) {
            this.snapshotBusy.set(false);
            return;
          }
          this.failSnapshotOperation(error);
        }
      });
    } catch (error: unknown) {
      this.failSnapshotOperation(error);
    }
  }

  private failSnapshotOperation(error: unknown): void {
    this.snapshotBusy.set(false);
    this.snapshotFeedbackError.set(true);
    if (error instanceof HttpErrorResponse && error.status === 401) {
      this.store.sessionActive.set(false);
      this.store.authenticationRequired.set(true);
      this.snapshotFeedback.set(this.i18n.text('sessionExpired'));
      return;
    }
    const problem = error instanceof HttpErrorResponse
      && isDomainRuleSnapshotProblemResponse(error.error)
      ? error.error
      : null;
    this.snapshotBlockers.set(problem?.code === 'TEST_EVIDENCE_BLOCKED' ? problem.blockers : []);
    const errorCode = error instanceof HttpErrorResponse && error.error && typeof error.error === 'object'
      ? (error.error as Record<string, unknown>)['code']
      : null;
    if (error instanceof HttpErrorResponse && error.status === 409 && errorCode === 'STALE_RULESET_CANDIDATE') {
      this.compositionCandidate.set(null);
      this.compositionApproval.set(null);
      this.snapshotFeedback.set(this.i18n.text('staleRuleSetCandidate'));
      this.loadSnapshots();
      return;
    }
    const key = error instanceof HttpErrorResponse && error.status === 403
      ? 'governedCommandForbidden'
      : problem?.code === 'TEST_EVIDENCE_BLOCKED'
        ? 'snapshotEvidenceBlocked'
      : error instanceof HttpErrorResponse && (error.status === 409 || error.status === 412 || error.status === 428)
        ? 'governedCommandConflict'
        : 'governedCommandFailed';
    this.snapshotFeedback.set(this.i18n.text(key));
    if (error instanceof HttpErrorResponse && (error.status === 409 || error.status === 412 || error.status === 428)) {
      this.loadSnapshots();
    }
  }

  private failRolloutPolicyOperation(error: unknown): void {
    this.rolloutPolicyBusy.set(false);
    this.rolloutPolicyFeedbackError.set(true);
    if (error instanceof HttpErrorResponse && error.status === 401) {
      this.store.sessionActive.set(false);
      this.store.authenticationRequired.set(true);
      this.rolloutPolicyFeedback.set(this.i18n.text('sessionExpired'));
      return;
    }
    const key = error instanceof HttpErrorResponse && error.status === 403
      ? 'governedCommandForbidden'
      : error instanceof HttpErrorResponse && (error.status === 409 || error.status === 412 || error.status === 428)
        ? 'governedCommandConflict'
        : 'governedCommandFailed';
    this.rolloutPolicyFeedback.set(this.i18n.text(key));
    if (error instanceof HttpErrorResponse && (error.status === 409 || error.status === 412 || error.status === 428)) {
      this.loadRolloutPolicies();
    }
  }
}
