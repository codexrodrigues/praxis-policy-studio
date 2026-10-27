import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnInit, computed, inject } from '@angular/core';
import {
  API_URL,
  DomainRuleService,
  ResourceDiscoveryService,
  type ApiUrlConfig,
  type DomainRuleDefinitionAction,
  type DomainRuleDefinitionRequest,
  type DomainRuleRolloutCatalogItem,
  type DomainRuleRolloutPolicy,
  type DomainRuleRolloutPolicyCreateRequest,
  type DomainRuleSnapshotVersion,
  type DomainRuleTestScenario,
  type DomainRuleWorkspaceAction
} from '@praxisui/core';
import type { RuleBuilderState } from '@praxisui/visual-builder';
import { AuthSessionService } from '../../core/auth-session.service';
import type { DecisionDiscoveryCandidate } from '../../core/decision-discovery.service';
import { PolicyStudioI18n } from '../../core/i18n';
import { ProjectionCatalogService } from '../../core/projection-catalog.service';
import type { PolicyStudioRuntimeConfig } from '../../core/runtime-config';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import { DecisionParametersEditorComponent } from '../authoring/decision-parameters-editor.component';
import { LocalDraftWorkspaceComponent } from '../authoring/local-draft-workspace.component';
import {
  buildDecisionMaturityPosture,
  buildExecutionCorrelationSummary,
  buildGovernanceGateSummary,
  type DecisionMaturityPosture,
  type ExecutionCorrelationSummary,
  type GovernanceGateId,
  type SuggestedDraftDiffProposal,
  type SuggestedScenarioTemplate
} from './catalog-presentation';
import { CatalogSelectionStore, type DecisionWorkMode } from './catalog-selection.store';
import type {
  DecisionFact,
  DecisionSummary,
  RuleSetCompositionCandidateCommand,
  RuleSetCompositionCandidateRequest
} from './catalog.fixture';
import { DecisionCreateFormComponent } from './decision-create-form.component';
import { DecisionDiscoveryComponent } from './decision-discovery.component';
import { DecisionExplanationComponent } from './decision-explanation.component';
import { GovernedConfirmationDialogComponent } from './governed-confirmation-dialog.component';
import { PolicySandboxResultsComponent } from './policy-sandbox-results.component';
import { ScenarioCatalogComponent, type ScenarioUpdateView } from './scenario-catalog.component';
import { ScenarioCreateFormComponent, type ScenarioCreateView } from './scenario-create-form.component';
import { ScenarioSandboxFacade } from './scenario-sandbox.facade';
import { SnapshotCockpitComponent } from './snapshot-cockpit.component';
import { SnapshotExecutionFacade } from './snapshot-execution.facade';
import { WorkspaceAuthoringFacade } from './workspace-authoring.facade';
import { WorkspaceBlockersComponent } from './workspace-blockers.component';

@Component({
  selector: 'pax-catalog-workspace',
  imports: [
    LocalDraftWorkspaceComponent,
    SnapshotCockpitComponent,
    DecisionExplanationComponent,
    DecisionDiscoveryComponent,
    GovernedConfirmationDialogComponent,
    PolicySandboxResultsComponent,
    WorkspaceBlockersComponent,
    ScenarioCatalogComponent,
    ScenarioCreateFormComponent,
    DecisionParametersEditorComponent,
    DecisionCreateFormComponent
  ],
  providers: [
    ProjectionCatalogService,
    DomainRuleService,
    ResourceDiscoveryService,
    CatalogSelectionStore,
    SnapshotExecutionFacade,
    ScenarioSandboxFacade,
    WorkspaceAuthoringFacade,
    { provide: API_URL, useValue: { default: { baseUrl: '' } } satisfies ApiUrlConfig }
  ],
  templateUrl: './catalog-workspace.component.html',
  styleUrl: './catalog-workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CatalogWorkspaceComponent implements OnInit {
  private readonly catalog = inject(ProjectionCatalogService);
  private readonly auth = inject(AuthSessionService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly runtime = inject(RuntimeConfigService);
  readonly store = inject(CatalogSelectionStore);
  readonly authoring = inject(WorkspaceAuthoringFacade);
  readonly testing = inject(ScenarioSandboxFacade);
  readonly snapshots = inject(SnapshotExecutionFacade);

  readonly query = this.store.query;
  readonly allDecisions = this.store.allDecisions;
  readonly selected = this.store.selected;
  readonly narrowDetailOpen = this.store.narrowDetailOpen;
  readonly activeMode = this.store.activeMode;
  readonly policyConfig = this.store.policyConfig;
  readonly loadError = this.store.loadError;
  readonly loading = this.store.loading;
  readonly authenticationRequired = this.store.authenticationRequired;
  readonly permissionLimited = this.store.permissionLimited;
  readonly authenticating = this.store.authenticating;
  readonly authenticationFailed = this.store.authenticationFailed;
  readonly sessionActive = this.store.sessionActive;
  readonly signingOut = this.store.signingOut;
  readonly logoutFailed = this.store.logoutFailed;
  readonly timeline = this.store.timeline;
  readonly timelineLoading = this.store.timelineLoading;
  readonly timelineError = this.store.timelineError;
  readonly lifecycle = this.store.lifecycle;
  readonly lifecycleLoading = this.store.lifecycleLoading;
  readonly lifecycleError = this.store.lifecycleError;
  readonly operationalTestEvidence = this.store.operationalTestEvidence;
  readonly authoringBusy = this.store.authoringBusy;
  readonly authoringError = this.store.authoringError;
  readonly authoringConflict = this.store.authoringConflict;
  readonly authoringFeedback = this.store.authoringFeedback;
  readonly governedConfirmation = this.store.governedConfirmation;
  readonly workspaceCapabilities = this.store.workspaceCapabilities;
  readonly workspaceCapabilitiesLoading = this.store.workspaceCapabilitiesLoading;
  readonly workspaceCapabilitiesError = this.store.workspaceCapabilitiesError;
  readonly decisions = this.store.decisions;
  readonly selectionOutsideFilter = this.store.selectionOutsideFilter;
  readonly eligibleSnapshotSources = this.store.eligibleSnapshotSources;
  readonly defaultSnapshotSourceDefinitionId = this.store.defaultSnapshotSourceDefinitionId;

  readonly authoringOpen = this.authoring.authoringOpen;
  readonly reviews = this.authoring.reviews;
  readonly reviewRationaleValue = this.authoring.reviewRationaleValue;
  readonly publicationReadiness = this.authoring.publicationReadiness;
  readonly publicationResult = this.authoring.publicationResult;
  readonly draftCondition = this.authoring.draftCondition;
  readonly draftParameters = this.authoring.draftParameters;
  readonly parameterValidationErrors = this.authoring.parameterValidationErrors;
  readonly editorState = this.authoring.editorState;
  readonly totalAuthoringValidationErrors = this.authoring.totalAuthoringValidationErrors;
  readonly originalExpression = this.authoring.originalExpression;
  readonly draftExpression = this.authoring.draftExpression;
  readonly editorCondition = this.authoring.editorCondition;
  readonly draftParametersChanged = this.authoring.draftParametersChanged;
  readonly draftChanged = this.authoring.draftChanged;
  readonly semanticDiff = this.authoring.semanticDiff;
  readonly editorConfig = this.authoring.editorConfig;
  readonly suggestedDiffProposals = this.authoring.suggestedDiffProposals;

  readonly scenarioFeedback = this.testing.scenarioFeedback;
  readonly scenarioError = this.testing.scenarioError;
  readonly sandboxFeedback = this.testing.sandboxFeedback;
  readonly sandboxError = this.testing.sandboxError;
  readonly scenarios = this.testing.scenarios;
  readonly scenarioFactDraft = this.testing.scenarioFactDraft;
  readonly scenarioFactsFallback = this.testing.scenarioFactsFallback;
  readonly scenarioFactsJson = this.testing.scenarioFactsJson;
  readonly activeScenarios = this.testing.activeScenarios;
  readonly suggestedScenarios = this.testing.suggestedScenarios;
  readonly editingScenarioId = this.testing.editingScenarioId;
  readonly editingScenarioDirty = this.testing.editingScenarioDirty;
  readonly editingScenarioFactDraft = this.testing.editingScenarioFactDraft;
  readonly operationalAction = this.testing.operationalAction;
  readonly operationalActionLoading = this.testing.operationalActionLoading;
  readonly operationalActionError = this.testing.operationalActionError;
  readonly operationalScenarioModes = this.testing.operationalScenarioModes;
  readonly operationalConfirmationOpen = this.testing.operationalConfirmationOpen;
  readonly operationalSelections = this.testing.operationalSelections;
  readonly sandboxRun = this.testing.sandboxRun;

  readonly snapshotHead = this.snapshots.snapshotHead;
  readonly snapshotVersions = this.snapshots.snapshotVersions;
  readonly snapshotsLoading = this.snapshots.snapshotsLoading;
  readonly snapshotsError = this.snapshots.snapshotsError;
  readonly snapshotBusy = this.snapshots.snapshotBusy;
  readonly snapshotFeedback = this.snapshots.snapshotFeedback;
  readonly snapshotFeedbackError = this.snapshots.snapshotFeedbackError;
  readonly snapshotBlockers = this.snapshots.snapshotBlockers;
  readonly executionSummary = this.snapshots.executionSummary;
  readonly executionSummaryLoading = this.snapshots.executionSummaryLoading;
  readonly executionSummaryError = this.snapshots.executionSummaryError;
  readonly hostStatusSummary = this.snapshots.hostStatusSummary;
  readonly hostStatusLoading = this.snapshots.hostStatusLoading;
  readonly hostStatusError = this.snapshots.hostStatusError;
  readonly rolloutPolicyCatalog = this.snapshots.rolloutPolicyCatalog;
  readonly rolloutPolicyTimeline = this.snapshots.rolloutPolicyTimeline;
  readonly rolloutPoliciesLoading = this.snapshots.rolloutPoliciesLoading;
  readonly rolloutPoliciesError = this.snapshots.rolloutPoliciesError;
  readonly rolloutPolicyBusy = this.snapshots.rolloutPolicyBusy;
  readonly rolloutPolicyFeedback = this.snapshots.rolloutPolicyFeedback;
  readonly rolloutPolicyFeedbackError = this.snapshots.rolloutPolicyFeedbackError;
  readonly rolloutCatalog = this.snapshots.rolloutCatalog;
  readonly rolloutLoading = this.snapshots.rolloutLoading;
  readonly rolloutError = this.snapshots.rolloutError;
  readonly rolloutBusy = this.snapshots.rolloutBusy;
  readonly rolloutFeedback = this.snapshots.rolloutFeedback;
  readonly rolloutFeedbackError = this.snapshots.rolloutFeedbackError;
  readonly compositionCandidate = this.snapshots.compositionCandidate;
  readonly compositionApproval = this.snapshots.compositionApproval;
  readonly compositionPublication = this.snapshots.compositionPublication;
  readonly governanceGateSummary = computed(() => buildGovernanceGateSummary(
    this.selected(),
    this.workspaceCapabilities(),
    this.reviews(),
    this.snapshotHead(),
    this.lifecycle()
  ));
  readonly maturityPosture = computed(() => buildDecisionMaturityPosture(
    this.selected(),
    this.snapshotHead()
  ));
  readonly executionCorrelation = computed(() => buildExecutionCorrelationSummary(
    this.selected(),
    this.lifecycle(),
    this.snapshotHead(),
    this.executionSummary(),
    this.hostStatusSummary()
  ));

  constructor(readonly i18n: PolicyStudioI18n) {}

  ngOnInit(): void {
    this.loadCatalog();
  }

  meaningText(decision: DecisionSummary): string {
    if (decision.meaning.trim() && decision.meaning.trim() !== decision.name.trim()) return decision.meaning;
    return `${this.i18n.text('decisionInDecisionSet')} ${decision.ruleSet}.`;
  }

  authorityLabel(authority: string): string {
    if (authority.includes('LEGACY_AUTHORITATIVE')) return this.i18n.text('legacyOperationalAuthority');
    if (authority.includes('CONFIG')) return this.i18n.text('configOperationalAuthority');
    return this.i18n.text('authorityNotDescribed');
  }

  persistenceLabel(authority: string): string {
    return authority.includes('KEEP_DB_BACKED')
      ? this.i18n.text('databaseBackedStrategy')
      : this.i18n.text('strategyNotDescribed');
  }

  configStatusLabel(status: string): string {
    const normalized = status.toUpperCase();
    if (normalized.includes('DRAFT')) return this.i18n.text('configDraftLabel');
    if (normalized === 'APPROVED') return this.i18n.text('configApprovedLabel');
    if (normalized === 'ACTIVE') return this.i18n.text('configActiveLabel');
    return this.i18n.text('configOtherStatus');
  }

  technicalMaturityLabel(value: DecisionMaturityPosture['technicalMaturity']): string {
    if (value === 'STRUCTURAL_VERIFIED') return this.i18n.text('maturityVerified');
    if (value === 'FACT_CATALOG_GAP') return this.i18n.text('maturityFactGap');
    return this.i18n.text('maturityDraftStructure');
  }

  approvalStageLabel(value: DecisionMaturityPosture['approvalStage']): string {
    if (value === 'PROMOTED_READY') return this.i18n.text('approvalStagePromoted');
    if (value === 'APPROVED') return this.i18n.text('approvalStageApproved');
    if (value === 'IN_REVIEW') return this.i18n.text('approvalStageInReview');
    if (value === 'REJECTED') return this.i18n.text('approvalStageRejected');
    return this.i18n.text('approvalStageDraft');
  }

  operationalAuthorityPostureLabel(value: DecisionMaturityPosture['operationalAuthority']): string {
    if (value === 'CONFIG_ACTIVE_SNAPSHOT') return this.i18n.text('authorityActiveSnapshot');
    if (value === 'CONFIG_AUTHORITATIVE') return this.i18n.text('authorityConfigDeclared');
    if (value === 'LEGACY_AUTHORITATIVE') return this.i18n.text('authorityLegacyDeclared');
    return this.i18n.text('authorityNotDescribed');
  }

  sloPostureLabel(value: ExecutionCorrelationSummary['sloPosture']): string {
    if (value === 'HEALTHY') return this.i18n.text('sloHealthy');
    if (value === 'DEGRADED') return this.i18n.text('sloDegraded');
    if (value === 'CRITICAL') return this.i18n.text('sloCritical');
    return this.i18n.text('sloUnobserved');
  }

  causalDiagnosisLabel(value: ExecutionCorrelationSummary['causalState']): string {
    if (value === 'HEALTHY') return this.i18n.text('causalDiagnosisHealthy');
    if (value === 'ERROR_OBSERVED') return this.i18n.text('causalDiagnosisError');
    return this.i18n.text('causalDiagnosisUnobserved');
  }

  isActionableDelegatedGate(gateId: GovernanceGateId): boolean {
    return gateId === 'SUBMIT' || gateId === 'PROMOTE' || gateId === 'PUBLISH_DEFINITION';
  }

  requestDelegatedGateCommand(gateId: GovernanceGateId): void {
    const current = this.selected();
    if (!current || this.authoringBusy()) return;
    if (gateId === 'SUBMIT' && this.hasWorkspaceAction('SUBMIT') && current.workspaceEtag && !this.draftChanged()) {
      this.store.openGovernedConfirmation(
        this.i18n.text('confirmDelegatedSubmit'),
        `${current.key} · ${current.workspaceEtag}`,
        this.i18n.text('submitReview'),
        () => this.submitGovernedWorkspace()
      );
      return;
    }
    if (gateId === 'PROMOTE' && this.hasWorkspaceAction('PROMOTE') && current.workspaceEtag) {
      this.store.openGovernedConfirmation(
        this.i18n.text('confirmDelegatedPromote'),
        `${current.key} · ${current.workspaceEtag}`,
        this.i18n.text('promoteWorkspace'),
        () => this.promoteGovernedWorkspace()
      );
      return;
    }
    if (gateId === 'PUBLISH_DEFINITION' && current.promotedDefinitionId && this.hasDefinitionAction('PUBLISH')) {
      this.store.openGovernedConfirmation(
        this.i18n.text('confirmDelegatedPublish'),
        `${current.key} · ${current.promotedDefinitionId}`,
        this.i18n.text('publishDefinition'),
        () => this.publishGovernedDefinition()
      );
    }
  }

  nullSemanticsLabel(value: string | null): string {
    if (!value) return this.i18n.text('notInformed');
    return value.toUpperCase() === 'FAIL_CLOSED'
      ? this.i18n.text('nullFailClosed')
      : this.i18n.text('nullBehaviorAvailableInTechnicalDetails');
  }

  decisionOutcomeLabel(outcome: string): string {
    const key = ({
      ALLOW: 'outcomeAllow', DENY: 'outcomeDeny', NOT_APPLICABLE: 'outcomeNotApplicable',
      INCONCLUSIVE: 'outcomeInconclusive', TECHNICAL_ERROR: 'outcomeTechnicalError'
    } as const)[outcome.toUpperCase() as 'ALLOW'];
    return key ? this.i18n.text(key) : this.i18n.text('outcomeUnknown');
  }

  scenarioStatusLabel(status: string): string {
    return status.toUpperCase() === 'ACTIVE' ? this.i18n.text('scenarioActiveLabel')
      : status.toUpperCase() === 'DISABLED' ? this.i18n.text('scenarioDisabledLabel')
        : this.i18n.text('statusUnknown');
  }

  workspaceStatusLabel(status: string): string {
    const key = ({
      OPEN: 'workspaceStateOpen', SUBMITTED: 'workspaceStateSubmitted', APPROVED: 'workspaceStateApproved',
      REJECTED: 'workspaceStateRejected', PROMOTED: 'workspaceStatePromoted'
    } as const)[status.toUpperCase() as 'OPEN'];
    return key ? this.i18n.text(key) : this.i18n.text('statusUnknown');
  }

  comparisonLabel(comparison: string): string {
    return comparison.toUpperCase().includes('MATCH') && !comparison.toUpperCase().includes('MISMATCH')
      ? this.i18n.text('comparisonMatch')
      : comparison.toUpperCase().includes('MISMATCH') ? this.i18n.text('comparisonMismatch')
        : this.i18n.text('comparisonUnavailable');
  }

  loadCatalog(): void {
    const loadRevision = ++this.store.catalogLoadRevision;
    const state = this.runtime.state();
    if (state.kind !== 'ready') return;
    this.loading.set(true);
    this.i18n.locale.set(state.config.locale);
    this.loadError.set(null);
    this.authenticationRequired.set(false);
    this.permissionLimited.set(false);
    this.catalog.load(this.i18n.locale(), state.config).subscribe({
      next: decisions => {
        if (loadRevision !== this.store.catalogLoadRevision) return;
        this.authenticationFailed.set(false);
        this.sessionActive.set(state.config.mode === 'remote');
        this.logoutFailed.set(false);
        this.allDecisions.set(decisions);
        const initial = decisions.find(item => item.key === state.config.initialDecisionKey) ?? decisions[0] ?? null;
        if (initial) this.select(initial, true, false);
        else this.clearSelection();
        this.loading.set(false);
      },
      error: (error: unknown) => {
        if (loadRevision !== this.store.catalogLoadRevision) return;
        this.loading.set(false);
        this.allDecisions.set([]);
        this.clearSelection();
        this.loadError.set(error instanceof Error ? error.message : 'PROJECTION_LOAD_FAILED');
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.sessionActive.set(false);
          this.authenticationRequired.set(true);
        } else if (error instanceof HttpErrorResponse && error.status === 403) {
          this.resolveForbiddenResponse(state.config, loadRevision);
        }
      }
    });
  }

  private resolveForbiddenResponse(config: PolicyStudioRuntimeConfig, catalogRevision: number): void {
    this.auth.hasSession(config).subscribe({
      next: active => {
        if (catalogRevision !== this.store.catalogLoadRevision) return;
        this.sessionActive.set(active);
        active ? this.permissionLimited.set(true) : this.authenticationRequired.set(true);
      },
      error: () => {
        if (catalogRevision !== this.store.catalogLoadRevision) return;
        this.loadError.set('SESSION_STATUS_UNAVAILABLE');
      }
    });
  }

  login(username: string, password: string, form: HTMLFormElement): void {
    const state = this.runtime.state();
    if (state.kind !== 'ready' || this.authenticating()) return;
    this.authenticating.set(true);
    this.authenticationFailed.set(false);
    this.auth.login(username, password, state.config).subscribe({
      next: () => {
        form.reset();
        this.authenticating.set(false);
        this.loadCatalog();
      },
      error: () => {
        form.reset();
        this.authenticating.set(false);
        this.authenticationFailed.set(true);
      }
    });
  }

  logout(): void {
    const state = this.runtime.state();
    if (state.kind !== 'ready' || !this.sessionActive() || this.signingOut()) return;
    this.signingOut.set(true);
    this.logoutFailed.set(false);
    this.auth.logout(state.config).subscribe({
      next: () => {
        ++this.store.catalogLoadRevision;
        this.signingOut.set(false);
        this.sessionActive.set(false);
        this.allDecisions.set([]);
        this.clearSelection();
        this.loading.set(false);
        this.permissionLimited.set(false);
        this.authenticationFailed.set(false);
        this.authenticationRequired.set(true);
        this.loadError.set('AUTHENTICATION_REQUIRED');
      },
      error: () => {
        this.signingOut.set(false);
        this.logoutFailed.set(true);
      }
    });
  }

  requestAuthentication(): void {
    ++this.store.catalogLoadRevision;
    this.loading.set(false);
    this.loadError.set(null);
    this.permissionLimited.set(false);
    this.authenticationFailed.set(false);
    this.sessionActive.set(false);
    this.authenticationRequired.set(true);
  }

  updateQuery(value: string): void { this.query.set(value); }

  clearQuery(): void {
    this.query.set('');
    requestAnimationFrame(() => this.host.nativeElement.querySelector<HTMLInputElement>('.search input')?.focus());
  }

  navigateToSection(sectionId: string): void {
    const modeBySection: Readonly<Record<string, DecisionWorkMode>> = {
      'decision-overview': 'understand',
      'decision-rule': 'rule',
      'decision-tests': 'test',
      'decision-execution': 'operate',
      'decision-history': 'history'
    };
    const mode = modeBySection[sectionId];
    if (!mode) return;
    this.activeMode.set(mode);
    requestAnimationFrame(() => {
      const target = this.host.nativeElement.querySelector<HTMLElement>(`#${sectionId}`);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.focus({ preventScroll: true });
    });
  }

  returnToCatalog(): void {
    if (this.hasUnsavedWork()) {
      this.store.openUnsavedWorkConfirmation(
        this.selected()?.name ?? this.i18n.text('localChanges'),
        () => this.completeReturnToCatalog());
      return;
    }
    this.completeReturnToCatalog();
  }

  private completeReturnToCatalog(): void {
    if (this.hasUnsavedWork()) this.discardUnsavedWorkState();
    this.narrowDetailOpen.set(false);
    requestAnimationFrame(() => {
      const search = this.host.nativeElement.querySelector<HTMLInputElement>('.search input');
      search?.scrollIntoView({ block: 'start' });
      search?.focus({ preventScroll: true });
    });
  }

  select(decision: DecisionSummary, forceReload = false, revealOnNarrow = true, discardConfirmed = false): void {
    if (decision.key === this.selected()?.key && !forceReload) {
      if (revealOnNarrow) this.narrowDetailOpen.set(true);
      this.revealSelectedDecision();
      return;
    }
    if (!discardConfirmed && (forceReload || decision.key !== this.selected()?.key) && this.hasUnsavedWork()) {
      const target = this.editingScenarioDirty()
        ? (this.scenarios().find(item => item.id === this.editingScenarioId())?.name ?? this.i18n.text('scenarioLocalChanges'))
        : (this.selected()?.name ?? this.i18n.text('localChanges'));
      this.store.openUnsavedWorkConfirmation(
        target,
        () => this.select(decision, forceReload, revealOnNarrow, true));
      return;
    }
    const selectionRevision = ++this.store.selectionRevision;
    this.selected.set(decision);
    this.narrowDetailOpen.set(revealOnNarrow);
    this.activeMode.set('understand');
    this.timeline.set([]);
    this.authoring.resetForSelection(decision);
    this.testing.resetForSelection();
    this.snapshots.resetForSelection();
    this.loadTimeline(selectionRevision);
    this.loadLifecycle(selectionRevision);
    this.loadScenarios(selectionRevision);
    this.loadReviews(selectionRevision);
    this.loadWorkspaceCapabilities(selectionRevision);
    this.loadOperationalTestAction(selectionRevision);
    this.loadSnapshots();
    this.hydrateSelectedDecision(decision, selectionRevision);
    this.revealSelectedDecision();
  }

  private hydrateSelectedDecision(decision: DecisionSummary, selectionRevision: number): void {
    const state = this.runtime.state();
    if (decision.detailHydrated !== false
      || !decision.configDefinitionId
      || !decision.configVersion
      || state.kind !== 'ready'
      || state.config.mode !== 'remote'
      || typeof this.catalog.loadDiscoveredCandidate !== 'function') {
      return;
    }
    const index = Math.max(0, this.allDecisions().findIndex(item => item.key === decision.key));
    const total = Math.max(this.allDecisions().length, decision.totalDecisions);
    this.catalog.loadDiscoveredCandidate(
      {
        definitionId: decision.configDefinitionId,
        ruleKey: decision.key,
        version: decision.configVersion,
        status: decision.configStatus ?? 'draft',
        ruleType: decision.ruleType ?? 'validation',
        contextKey: decision.domain,
        resourceKey: decision.resourceKey,
        serviceKey: decision.serviceKey,
        semanticOwner: null,
        updatedAt: ''
      },
      index,
      total,
      this.i18n.locale(),
      state.config
    ).subscribe({
      next: hydrated => {
        if (selectionRevision !== this.store.selectionRevision || this.hasUnsavedWork()) return;
        this.allDecisions.update(items => items.map(item => item.key === hydrated.key ? hydrated : item));
        this.selected.set(hydrated);
        this.authoring.resetForSelection(hydrated);
        if (hydrated.resourceKey !== decision.resourceKey) {
          this.loadOperationalTestAction(selectionRevision);
        }
        if (hydrated.ruleSetKey !== decision.ruleSetKey) {
          this.loadSnapshots();
        }
      },
      error: error => this.store.failAuthoringCommand(error, selectionRevision, decision.key)
    });
  }

  selectDiscoveredCandidate(candidate: DecisionDiscoveryCandidate): void {
    const existing = this.allDecisions().find(decision =>
      decision.configDefinitionId === candidate.definitionId
      && decision.key === candidate.ruleKey
      && decision.configVersion === candidate.version);
    if (existing) {
      this.select(existing);
      return;
    }
    const state = this.runtime.state();
    if (state.kind !== 'ready' || this.authoringBusy()) return;
    const currentDecisions = this.allDecisions();
    this.authoringBusy.set(true);
    this.authoringError.set(false);
    this.catalog.loadDiscoveredCandidate(
      candidate,
      currentDecisions.length,
      currentDecisions.length + 1,
      this.i18n.locale(),
      state.config
    ).subscribe({
      next: resolvedDecision => {
        this.authoringBusy.set(false);
        const nextTotal = this.allDecisions().length + 1;
        const updated = [
          ...this.allDecisions().map(item => ({ ...item, totalDecisions: Math.max(item.totalDecisions, nextTotal) })),
          { ...resolvedDecision, totalDecisions: nextTotal }
        ];
        this.allDecisions.set(updated);
        this.select(updated[updated.length - 1], true, true);
      },
      error: () => {
        this.authoringBusy.set(false);
        this.authoringError.set(true);
      }
    });
  }

  reloadGovernedEvidence(): void {
    const state = this.runtime.state();
    const current = this.selected();
    if (state.kind !== 'ready' || !current || this.authoringBusy()) return;
    const currentKey = current.key;
    const previousMode = this.activeMode();
    const wasAuthoringOpen = this.authoringOpen();
    const loadRevision = ++this.store.catalogLoadRevision;
    this.authoringBusy.set(true);
    this.store.clearAuthoringMessage();
    this.catalog.load(this.i18n.locale(), {
      ...state.config,
      initialDecisionKey: currentKey
    }).subscribe({
      next: decisions => {
        if (loadRevision !== this.store.catalogLoadRevision) return;
        this.authoringBusy.set(false);
        this.allDecisions.set(decisions);
        const refreshed = decisions.find(item => item.key === currentKey) ?? decisions[0] ?? null;
        if (!refreshed) {
          this.clearSelection();
          return;
        }
        const selectionRevision = ++this.store.selectionRevision;
        this.selected.set(refreshed);
        this.timeline.set([]);
        this.authoring.resetForSelection(refreshed);
        this.testing.resetForSelection();
        this.snapshots.resetForSelection();
        this.activeMode.set(previousMode);
        this.loadTimeline(selectionRevision);
        this.loadLifecycle(selectionRevision);
        this.loadScenarios(selectionRevision);
        this.loadReviews(selectionRevision);
        this.loadWorkspaceCapabilities(selectionRevision);
        this.loadOperationalTestAction(selectionRevision);
        this.loadSnapshots();
        if (wasAuthoringOpen && refreshed.authoringSupported) {
          this.authoringOpen.set(true);
        }
        this.authoringFeedback.set(this.i18n.text('governedEvidenceReloaded'));
      },
      error: (error: unknown) => {
        if (loadRevision !== this.store.catalogLoadRevision) return;
        this.store.failAuthoring(error);
      }
    });
  }

  loadTimeline(selectionRevision = this.store.selectionRevision): void {
    this.store.loadTimeline(selectionRevision);
  }

  loadLifecycle(selectionRevision = this.store.selectionRevision): void {
    this.store.loadLifecycle(selectionRevision);
  }

  loadSnapshots(): void {
    this.snapshots.loadSnapshots();
  }

  loadRolloutPolicies(ruleSetKey: string | null = this.selected()?.ruleSetKey ?? null): void {
    this.snapshots.loadRolloutPolicies(ruleSetKey);
  }

  loadRollouts(ruleSetKey: string | null = this.selected()?.ruleSetKey ?? null): void {
    this.snapshots.loadRollouts(ruleSetKey);
  }

  loadHostStatusSummary(ruleSetKey: string | null = this.selected()?.ruleSetKey ?? null): void {
    this.snapshots.loadHostStatusSummary(ruleSetKey);
  }

  loadExecutionSummary(snapshotKey: string | null = this.snapshotHead()?.activeSnapshotKey ?? null): void {
    this.snapshots.loadExecutionSummary(snapshotKey);
  }

  hasEditableParameters(decision: DecisionSummary | null | undefined): boolean {
    return this.authoring.hasEditableParameters(decision);
  }

  canOpenAuthoring(decision: DecisionSummary | null | undefined): boolean {
    return this.authoring.canOpenAuthoring(decision);
  }

  effectiveParameters(decision: DecisionSummary | null | undefined): Readonly<Record<string, unknown>> {
    return this.authoring.effectiveParameters(decision);
  }

  openAuthoring(): void {
    this.authoring.openAuthoring();
  }

  openAuthoringAndFocus(): void {
    this.openAuthoring();
    if (!this.authoringOpen()) return;
    this.activeMode.set('rule');
    requestAnimationFrame(() => this.host.nativeElement.querySelector<HTMLElement>('.draft-workspace')?.focus());
  }

  closeAuthoring(): void {
    this.authoring.closeAuthoring();
  }

  updateDraft(condition: unknown): void {
    this.authoring.updateDraft(condition);
  }

  updateDraftParameters(parameters: Readonly<Record<string, unknown>>): void {
    this.authoring.updateDraftParameters(parameters);
  }

  applyDiffProposal(proposal: SuggestedDraftDiffProposal): void {
    this.authoring.applyDiffProposal(proposal);
  }

  updateEditorState(state: RuleBuilderState): void {
    this.authoring.updateEditorState(state);
  }

  resetDraft(): void {
    this.authoring.resetDraft();
  }

  createGovernedDecision(request: DomainRuleDefinitionRequest): void {
    this.authoring.createGovernedDecision(request, match => this.select(match, true, false, true));
  }

  reportDecisionCreateValidation(message: string): void {
    this.authoring.reportDecisionCreateValidation(message);
  }

  createWorkspace(): void {
    this.authoring.createWorkspace();
  }

  saveGovernedDraft(): void {
    this.authoring.saveGovernedDraft();
  }

  loadScenarios(selectionRevision = this.store.selectionRevision): void {
    this.testing.loadScenarios(selectionRevision);
  }

  loadReviews(selectionRevision = this.store.selectionRevision): void {
    this.authoring.loadReviews(selectionRevision);
  }

  loadWorkspaceCapabilities(selectionRevision = this.store.selectionRevision): void {
    this.store.loadWorkspaceCapabilities(selectionRevision);
  }

  hasWorkspaceAction(action: DomainRuleWorkspaceAction): boolean {
    return this.store.hasWorkspaceAction(action);
  }

  hasDefinitionAction(action: DomainRuleDefinitionAction): boolean {
    return this.store.hasDefinitionAction(action);
  }

  loadOperationalTestAction(selectionRevision = this.store.selectionRevision): void {
    this.testing.loadOperationalTestAction(selectionRevision);
  }

  setOperationalScenarioMode(scenarioId: string, value: string): void {
    this.testing.setOperationalScenarioMode(scenarioId, value);
  }

  reviewOperationalTest(): void {
    this.testing.reviewOperationalTest();
  }

  cancelOperationalTest(): void {
    this.testing.cancelOperationalTest();
  }

  runOperationalTest(): void {
    this.testing.runOperationalTest();
  }

  createScenario(
    key: string,
    name: string,
    factsJson: string,
    expectedDecision: string,
    expectedOutputJson: string,
    expectedReasonCodes: string,
    expectedEffectIntents: string,
    form: HTMLFormElement
  ): void {
    this.testing.createScenario(
      key, name, factsJson, expectedDecision, expectedOutputJson,
      expectedReasonCodes, expectedEffectIntents, form,
      workspace => this.authoring.applyWorkspace(workspace)
    );
  }

  createScenarioFromView(request: ScenarioCreateView): void {
    this.testing.createScenarioFromView(request, workspace => this.authoring.applyWorkspace(workspace));
  }

  applyScenarioSuggestion(template: SuggestedScenarioTemplate): void {
    this.testing.applyScenarioSuggestion(template);
  }

  setScenarioFactValue(fact: DecisionFact, rawValue: string | boolean): void {
    this.testing.setScenarioFactValue(fact, rawValue);
  }

  setScenarioFactNull(fact: DecisionFact, useNull: boolean): void {
    this.testing.setScenarioFactNull(fact, useNull);
  }

  editScenario(scenarioId: string): void {
    this.testing.editScenario(scenarioId);
  }

  cancelScenarioEdit(): void {
    this.testing.cancelScenarioEdit();
  }

  markScenarioEditDirty(): void {
    this.testing.markScenarioEditDirty();
  }

  setEditingScenarioFactValue(fact: DecisionFact, rawValue: string | boolean): void {
    this.testing.setEditingScenarioFactValue(fact, rawValue);
  }

  setEditingScenarioFactNull(fact: DecisionFact, useNull: boolean): void {
    this.testing.setEditingScenarioFactNull(fact, useNull);
  }

  editingScenarioFactsJson(): string {
    return this.testing.editingScenarioFactsJson();
  }

  updateScenario(
    scenario: DomainRuleTestScenario,
    key: string,
    name: string,
    factsJson: string,
    expectedDecision: string,
    status: string,
    expectedOutputJson: string,
    expectedReasonCodes: string,
    expectedEffectIntents: string
  ): void {
    this.testing.updateScenario(
      scenario, key, name, factsJson, expectedDecision, status,
      expectedOutputJson, expectedReasonCodes, expectedEffectIntents,
      workspace => this.authoring.applyWorkspace(workspace)
    );
  }

  updateScenarioFromView(request: ScenarioUpdateView): void {
    this.testing.updateScenarioFromView(request, workspace => this.authoring.applyWorkspace(workspace));
  }

  runGovernedSandbox(): void {
    this.testing.runGovernedSandbox();
  }

  submitGovernedWorkspace(): void {
    this.authoring.submitGovernedWorkspace();
  }

  reviewGovernedWorkspace(
    decision: 'APPROVE' | 'REJECT',
    rationale: string,
    form: HTMLFormElement
  ): void {
    this.authoring.reviewGovernedWorkspace(decision, rationale, form);
  }

  promoteGovernedWorkspace(): void {
    this.authoring.promoteGovernedWorkspace();
  }

  inspectPublicationReadiness(): void {
    this.authoring.inspectPublicationReadiness();
  }

  publishGovernedDefinition(): void {
    this.authoring.publishGovernedDefinition();
  }

  createRolloutPolicy(request: DomainRuleRolloutPolicyCreateRequest): void {
    this.snapshots.createRolloutPolicy(request);
  }

  approveRolloutPolicy(policy: DomainRuleRolloutPolicy): void {
    this.snapshots.approveRolloutPolicy(policy);
  }

  activateRolloutPolicy(policy: DomainRuleRolloutPolicy): void {
    this.snapshots.activateRolloutPolicy(policy);
  }

  createRollout(candidateSnapshotKey: string): void {
    this.snapshots.createRollout(candidateSnapshotKey);
  }

  cancelRollout(item: DomainRuleRolloutCatalogItem): void {
    this.snapshots.cancelRollout(item);
  }

  activateRollout(item: DomainRuleRolloutCatalogItem): void {
    this.snapshots.activateRollout(item);
  }

  operateSnapshot(version: DomainRuleSnapshotVersion): void {
    this.snapshots.operateSnapshot(version);
  }

  invalidateSnapshotCompositionDraft(): void {
    this.snapshots.invalidateSnapshotCompositionDraft();
  }

  prepareSnapshotComposition(request: RuleSetCompositionCandidateRequest): void {
    this.snapshots.prepareSnapshotComposition(request);
  }

  approveSnapshotComposition(command: RuleSetCompositionCandidateCommand): void {
    this.snapshots.approveSnapshotComposition(command);
  }

  publishSnapshotComposition(command: RuleSetCompositionCandidateCommand): void {
    this.snapshots.publishSnapshotComposition(command);
  }

  confirmGovernedOperation(): void {
    this.store.confirmGovernedOperation();
  }

  cancelGovernedOperation(): void {
    this.store.cancelGovernedOperation();
  }

  displayDiffValue(value: unknown): string {
    return value === undefined ? '—' : JSON.stringify(value);
  }

  @HostListener('window:beforeunload', ['$event'])
  protectDraftOnUnload(event: BeforeUnloadEvent): void {
    if (!this.hasUnsavedWork()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  private hasUnsavedWork(): boolean {
    return (this.authoringOpen() && this.draftChanged()) || this.editingScenarioDirty();
  }

  private discardUnsavedWorkState(): void {
    if (this.authoringOpen() && this.draftChanged()) {
      this.authoring.completeCloseAuthoring();
    }
    if (this.editingScenarioDirty()) {
      this.testing.discardScenarioEditState();
    }
  }

  private revealSelectedDecision(): void {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (window.matchMedia?.('(max-width: 760px)').matches) {
        const back = this.host.nativeElement.querySelector<HTMLElement>('.narrow-back');
        back?.scrollIntoView({ block: 'start' });
        back?.focus({ preventScroll: true });
        return;
      }
      this.host.nativeElement.querySelector<HTMLElement>('.decision-row.selected')
        ?.scrollIntoView({ block: 'center', inline: 'nearest' });
    }));
  }

  private clearSelection(): void {
    ++this.store.selectionRevision;
    this.store.invalidateSharedLoadsAndReset();
    this.authoring.clearAll();
    this.testing.clearAll();
    this.snapshots.clearAll();
    this.selected.set(null);
    this.narrowDetailOpen.set(false);
  }
}
