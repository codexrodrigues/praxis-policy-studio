import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal, type WritableSignal } from '@angular/core';
import type {
  DomainRuleDefinitionAction,
  DomainRuleWorkspaceAction,
  DomainRuleWorkspaceCapabilities
} from '@praxisui/core';
import { PolicyStudioI18n } from '../../core/i18n';
import { ProjectionCatalogService } from '../../core/projection-catalog.service';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import type {
  DecisionLifecycleSummary,
  DecisionSummary,
  DecisionTimelineEvent
} from './catalog.fixture';
import { effectiveDecisionParameters, isPublishableSnapshotSource } from './catalog-presentation';
import type { GovernedConfirmationView } from './governed-confirmation-dialog.component';
import type { SnapshotSourceCandidate } from './snapshot-cockpit.component';

export interface PendingGovernedConfirmation extends GovernedConfirmationView {
  readonly execute: () => void;
}

export type DecisionWorkMode = 'understand' | 'rule' | 'test' | 'operate' | 'history';

@Injectable()
export class CatalogSelectionStore {
  readonly catalog = inject(ProjectionCatalogService);
  readonly runtime = inject(RuntimeConfigService);
  readonly i18n = inject(PolicyStudioI18n);

  readonly query = signal('');
  readonly allDecisions = signal<readonly DecisionSummary[]>([]);
  readonly selected = signal<DecisionSummary | null>(null);
  readonly narrowDetailOpen = signal(false);
  readonly activeMode = signal<DecisionWorkMode>('understand');
  readonly policyConfig = computed(() => {
    const state = this.runtime.state();
    return state.kind === 'ready' ? state.config : null;
  });

  readonly loadError = signal<string | null>(null);
  readonly loading = signal(true);
  readonly authenticationRequired = signal(false);
  readonly permissionLimited = signal(false);
  readonly authenticating = signal(false);
  readonly authenticationFailed = signal(false);
  readonly sessionActive = signal(false);
  readonly signingOut = signal(false);
  readonly logoutFailed = signal(false);

  readonly authoringBusy = signal(false);
  readonly authoringError = signal(false);
  readonly authoringConflict = signal(false);
  readonly authoringFeedback = signal<string | null>(null);
  readonly governedConfirmation = signal<PendingGovernedConfirmation | null>(null);

  readonly timeline = signal<readonly DecisionTimelineEvent[]>([]);
  readonly timelineLoading = signal(false);
  readonly timelineError = signal(false);

  readonly lifecycle = signal<DecisionLifecycleSummary | null>(null);
  readonly lifecycleLoading = signal(false);
  readonly lifecycleError = signal(false);
  readonly operationalTestEvidence = computed(() => this.lifecycle()?.latestTestRun?.results
    .flatMap(result => result.operationalEvidence
      ? [{ scenarioKey: result.scenarioKey, evidence: result.operationalEvidence }]
      : []) ?? []);

  readonly workspaceCapabilities = signal<DomainRuleWorkspaceCapabilities | null>(null);
  readonly workspaceCapabilitiesLoading = signal(false);
  readonly workspaceCapabilitiesError = signal(false);

  readonly decisions = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    return query
      ? this.allDecisions().filter(item => `${item.code} ${item.name} ${item.domain}`.toLocaleLowerCase().includes(query))
      : this.allDecisions();
  });

  readonly selectionOutsideFilter = computed(() => {
    const selected = this.selected();
    return !!this.query().trim() && !!selected && !this.decisions().some(item => item.key === selected.key);
  });

  readonly eligibleSnapshotSources = computed<readonly SnapshotSourceCandidate[]>(() => {
    const ruleSetKey = this.selected()?.ruleSetKey;
    if (!ruleSetKey) return [];
    return this.allDecisions()
      .filter(item => item.ruleSetKey === ruleSetKey && isPublishableSnapshotSource(item))
      .map(item => {
        const effectiveParams = effectiveDecisionParameters(item);
        const paramValues = effectiveParams['parameterValues'];
        const promotedId = item.promotedDefinitionId ?? null;
        return {
          definitionId: (promotedId ?? item.configDefinitionId)!,
          ruleKey: item.key,
          name: item.name,
          status: promotedId ? 'approved' : (item.configStatus ?? 'approved'),
          version: item.configVersion ?? 1,
          domain: item.domain,
          operationKeys: item.operationKeys,
          parameterCatalog: item.parameterCatalog ?? null,
          parameterValues: paramValues && typeof paramValues === 'object' && !Array.isArray(paramValues)
            ? (paramValues as Readonly<Record<string, unknown>>)
            : null
        };
      });
  });

  readonly defaultSnapshotSourceDefinitionId = computed<string | null>(() => {
    const current = this.selected();
    if (!current || !isPublishableSnapshotSource(current)) {
      return this.eligibleSnapshotSources()[0]?.definitionId ?? null;
    }
    return current.promotedDefinitionId ?? current.configDefinitionId ?? null;
  });

  catalogLoadRevision = 0;
  selectionRevision = 0;
  private timelineLoadRevision = 0;
  private lifecycleLoadRevision = 0;
  private workspaceCapabilitiesLoadRevision = 0;

  hasWorkspaceAction(action: DomainRuleWorkspaceAction): boolean {
    return this.workspaceCapabilities()?.availableActions.includes(action) ?? false;
  }

  hasDefinitionAction(action: DomainRuleDefinitionAction): boolean {
    return this.selected()?.availableDefinitionActions.includes(action) ?? false;
  }

  isCurrentDefinition(revision: number, definitionId: string): boolean {
    return revision === this.selectionRevision && this.selected()?.configDefinitionId === definitionId;
  }

  isCurrentWorkspace(revision: number, workspaceId: string): boolean {
    return revision === this.selectionRevision && this.selected()?.workspaceId === workspaceId;
  }

  isCurrentCommand(revision: number, ruleKey: string, workspaceId?: string): boolean {
    const current = this.selected();
    return revision === this.selectionRevision
      && current?.key === ruleKey
      && (!workspaceId || current.workspaceId === workspaceId);
  }

  loadTimeline(selectionRevision = this.selectionRevision): void {
    const loadRevision = ++this.timelineLoadRevision;
    const state = this.runtime.state();
    const definitionId = this.selected()?.configDefinitionId;
    this.timeline.set([]);
    this.timelineError.set(false);
    if (state.kind !== 'ready' || !definitionId) {
      this.timelineLoading.set(false);
      return;
    }
    this.timelineLoading.set(true);
    this.catalog.timeline(definitionId, state.config).subscribe({
      next: events => {
        if (loadRevision !== this.timelineLoadRevision || !this.isCurrentDefinition(selectionRevision, definitionId)) return;
        this.timeline.set(events);
        this.timelineLoading.set(false);
      },
      error: () => {
        if (loadRevision !== this.timelineLoadRevision || !this.isCurrentDefinition(selectionRevision, definitionId)) return;
        this.timelineLoading.set(false);
        this.timelineError.set(true);
      }
    });
  }

  loadLifecycle(selectionRevision = this.selectionRevision): void {
    const loadRevision = ++this.lifecycleLoadRevision;
    const state = this.runtime.state();
    const decision = this.selected();
    this.lifecycle.set(null);
    this.lifecycleError.set(false);
    if (state.kind !== 'ready' || !decision?.workspaceId) {
      this.lifecycleLoading.set(false);
      return;
    }
    this.lifecycleLoading.set(true);
    this.catalog.lifecycle(decision.workspaceId, state.config).subscribe({
      next: lifecycle => {
        if (loadRevision !== this.lifecycleLoadRevision || !this.isCurrentWorkspace(selectionRevision, decision.workspaceId!)) return;
        this.lifecycle.set(lifecycle);
        this.lifecycleLoading.set(false);
      },
      error: () => {
        if (loadRevision !== this.lifecycleLoadRevision || !this.isCurrentWorkspace(selectionRevision, decision.workspaceId!)) return;
        this.lifecycleLoading.set(false);
        this.lifecycleError.set(true);
      }
    });
  }

  loadWorkspaceCapabilities(selectionRevision = this.selectionRevision): void {
    const loadRevision = ++this.workspaceCapabilitiesLoadRevision;
    const state = this.runtime.state();
    const workspaceId = this.selected()?.workspaceId;
    this.workspaceCapabilities.set(null);
    this.workspaceCapabilitiesError.set(false);
    if (state.kind !== 'ready' || !workspaceId) {
      this.workspaceCapabilitiesLoading.set(false);
      return;
    }
    this.workspaceCapabilitiesLoading.set(true);
    this.catalog.workspaceCapabilities(workspaceId, state.config).subscribe({
      next: capabilities => {
        if (loadRevision !== this.workspaceCapabilitiesLoadRevision
          || !this.isCurrentWorkspace(selectionRevision, workspaceId)) return;
        this.workspaceCapabilities.set(capabilities);
        this.workspaceCapabilitiesLoading.set(false);
      },
      error: () => {
        if (loadRevision !== this.workspaceCapabilitiesLoadRevision
          || !this.isCurrentWorkspace(selectionRevision, workspaceId)) return;
        this.workspaceCapabilitiesLoading.set(false);
        this.workspaceCapabilitiesError.set(true);
      }
    });
  }

  clearAuthoringMessage(): void {
    this.authoringError.set(false);
    this.authoringConflict.set(false);
    this.authoringFeedback.set(null);
  }

  clearTaskMessage(feedback: WritableSignal<string | null>, error: WritableSignal<boolean>): void {
    error.set(false);
    feedback.set(null);
  }

  failTask(
    failure: unknown,
    feedback: WritableSignal<string | null>,
    error: WritableSignal<boolean>
  ): void {
    this.authoringBusy.set(false);
    error.set(true);
    if (failure instanceof HttpErrorResponse && failure.status === 401) {
      this.sessionActive.set(false);
      this.authenticationRequired.set(true);
      this.authoringConflict.set(false);
      feedback.set(this.i18n.text('sessionExpired'));
      return;
    }
    const isConflict = failure instanceof HttpErrorResponse
      && (failure.status === 409 || failure.status === 412 || failure.status === 428);
    this.authoringConflict.set(isConflict);
    const key = failure instanceof HttpErrorResponse && failure.status === 403
      ? 'governedCommandForbidden'
      : isConflict
        ? 'governedCommandConflict'
        : 'governedCommandFailed';
    feedback.set(this.i18n.text(key));
  }

  failTaskCommand(
    failure: unknown,
    revision: number,
    ruleKey: string,
    workspaceId: string | undefined,
    feedback: WritableSignal<string | null>,
    error: WritableSignal<boolean>
  ): void {
    if (!this.isCurrentCommand(revision, ruleKey, workspaceId)) {
      this.authoringBusy.set(false);
      return;
    }
    this.failTask(failure, feedback, error);
  }

  failAuthoring(error: unknown): void {
    this.authoringBusy.set(false);
    this.authoringError.set(true);
    if (error instanceof HttpErrorResponse && error.status === 401) {
      this.sessionActive.set(false);
      this.authenticationRequired.set(true);
      this.authoringConflict.set(false);
      this.authoringFeedback.set(this.i18n.text('sessionExpired'));
      return;
    }
    const isConflict = error instanceof HttpErrorResponse
      && (error.status === 409 || error.status === 412 || error.status === 428);
    this.authoringConflict.set(isConflict);
    const key = error instanceof HttpErrorResponse && error.status === 403
      ? 'governedCommandForbidden'
      : isConflict
        ? 'governedCommandConflict'
        : 'governedCommandFailed';
    this.authoringFeedback.set(this.i18n.text(key));
  }

  failAuthoringCommand(
    error: unknown,
    revision: number,
    ruleKey: string,
    workspaceId?: string
  ): void {
    if (!this.isCurrentCommand(revision, ruleKey, workspaceId)) {
      this.authoringBusy.set(false);
      return;
    }
    this.failAuthoring(error);
  }

  openGovernedConfirmation(
    message: string,
    target: string,
    confirmLabel: string,
    execute: () => void
  ): void {
    this.governedConfirmation.set({
      title: this.i18n.text('governedConfirmationTitle'),
      message,
      target,
      confirmLabel,
      cancelLabel: this.i18n.text('cancel'),
      execute
    });
  }

  openUnsavedWorkConfirmation(target: string, execute: () => void): void {
    this.governedConfirmation.set({
      title: this.i18n.text('unsavedWorkTitle'),
      message: this.i18n.text('discardChanges'),
      target,
      confirmLabel: this.i18n.text('discardLocalChanges'),
      cancelLabel: this.i18n.text('keepEditing'),
      execute
    });
  }

  confirmGovernedOperation(): void {
    const pending = this.governedConfirmation();
    this.governedConfirmation.set(null);
    pending?.execute();
  }

  cancelGovernedOperation(): void {
    this.governedConfirmation.set(null);
  }

  invalidateSharedLoadsAndReset(): void {
    ++this.timelineLoadRevision;
    ++this.lifecycleLoadRevision;
    ++this.workspaceCapabilitiesLoadRevision;
    this.authoringBusy.set(false);
    this.authoringError.set(false);
    this.authoringConflict.set(false);
    this.authoringFeedback.set(null);
    this.governedConfirmation.set(null);
    this.timeline.set([]);
    this.timelineLoading.set(false);
    this.timelineError.set(false);
    this.lifecycle.set(null);
    this.lifecycleLoading.set(false);
    this.lifecycleError.set(false);
    this.workspaceCapabilities.set(null);
    this.workspaceCapabilitiesLoading.set(false);
    this.workspaceCapabilitiesError.set(false);
  }
}
