import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  API_URL,
  DomainRuleService,
  PraxisThemeService,
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
import { skip } from 'rxjs';
import { AuthSessionService } from '../../core/auth-session.service';
import type { ExplorerGlobalLens } from '../../core/catalog-portfolio';
import type { DecisionDiscoveryCandidate } from '../../core/decision-discovery.service';
import { GovernedHostScopeService } from '../../core/governed-host-scope.service';
import { humanizeDecisionTitle, humanizeTechnicalSlug, looksLikeTechnicalSlug } from '../../core/humanize-labels';
import { PolicyStudioI18n } from '../../core/i18n';
import { ProjectionCatalogService } from '../../core/projection-catalog.service';
import {
  buildRuleParameterDisplayEntries,
  type RuleParameterDisplayEntry
} from '../../core/rule-parameters-display';
import {
  isSafeLegalBasisUrl,
  type RuleDocumentationDescriptor
} from '../../core/rule-documentation';
import {
  resolveGovernanceGlossaryEntry,
  resolvePolicyGlossaryEntry,
  resolveStatusGlossaryEntry,
  type StudioGlossaryEntry,
  type StudioGovernanceTermKey
} from '../../core/studio-glossary';
import type { CommandPaletteActionId } from '../../core/studio-command-palette';
import type { PolicyStudioRuntimeConfig } from '../../core/runtime-config';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import { StudioShellStateService, type StudioInspectorTab } from '../../core/studio-shell-state.service';
import { StudioIconComponent, type StudioIconName } from '../../shared/studio-icon.component';
import { TermPopoverComponent } from '../../shared/term-popover.component';
import { DecisionDocumentationEditorComponent } from '../authoring/decision-documentation-editor.component';
import { DecisionParametersEditorComponent } from '../authoring/decision-parameters-editor.component';
import { LocalDraftWorkspaceComponent } from '../authoring/local-draft-workspace.component';
import { AccessAuthorizationWorkspaceComponent } from './access-authorization-workspace.component';
import { CatalogPortfolioOverviewComponent } from './catalog-portfolio-overview.component';
import { DecisionExplorerRailComponent } from './decision-explorer-rail.component';
import { DecisionInspectorRailComponent } from './decision-inspector-rail.component';
import { DecisionRuleInspectionComponent } from './decision-rule-inspection.component';
import { RuleDecisionPlanDagComponent } from './rule-decision-plan-dag.component';
import { StudioCommandPaletteComponent } from './studio-command-palette.component';
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
    GovernedConfirmationDialogComponent,
    PolicySandboxResultsComponent,
    WorkspaceBlockersComponent,
    ScenarioCatalogComponent,
    ScenarioCreateFormComponent,
    DecisionDocumentationEditorComponent,
    DecisionParametersEditorComponent,
    RuleDecisionPlanDagComponent,
    CatalogPortfolioOverviewComponent,
    DecisionExplorerRailComponent,
    DecisionInspectorRailComponent,
    DecisionRuleInspectionComponent,
    AccessAuthorizationWorkspaceComponent,
    StudioCommandPaletteComponent,
    StudioIconComponent,
    TermPopoverComponent
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
  private readonly hostScope = inject(GovernedHostScopeService);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly theme = inject(PraxisThemeService);
  readonly shell = inject(StudioShellStateService);
  readonly runtime = inject(RuntimeConfigService);
  readonly store = inject(CatalogSelectionStore);
  readonly authoring = inject(WorkspaceAuthoringFacade);
  readonly testing = inject(ScenarioSandboxFacade);
  readonly snapshots = inject(SnapshotExecutionFacade);

  private readonly loadedModesForSelection = new Set<DecisionWorkMode>(['understand']);

  readonly activeWorkspaceTrack = this.store.activeWorkspaceTrack;
  readonly viewDepth = this.store.viewDepth;
  readonly inspectorTab = this.store.inspectorTab;
  readonly inspectorOpen = this.store.inspectorOpen;
  readonly explorerOpen = this.store.explorerOpen;
  readonly query = this.store.query;
  readonly contextScopeFilter = this.store.contextScopeFilter;
  readonly activeRuleTypeFilter = this.store.activeRuleTypeFilter;
  readonly explorerGlobalLens = this.store.explorerGlobalLens;
  readonly portfolioOverviewOpen = this.store.portfolioOverviewOpen;
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
  readonly draftDocumentation = this.authoring.draftDocumentation;
  readonly documentationValidationErrors = this.authoring.documentationValidationErrors;
  readonly draftDocumentationChanged = this.authoring.draftDocumentationChanged;
  readonly editorState = this.authoring.editorState;
  readonly ontologyInspection = this.authoring.ontologyInspection;
  readonly ontologicalWarning = this.authoring.ontologicalWarning;
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
  readonly canScaffoldScenarioOntology = this.testing.canScaffoldScenarioOntology;
  readonly scenarioOntologyWarning = this.testing.scenarioOntologyWarning;
  readonly editingScenarioId = this.testing.editingScenarioId;
  readonly editingScenarioDirty = this.testing.editingScenarioDirty;
  readonly editingScenarioFactDraft = this.testing.editingScenarioFactDraft;
  readonly operationalAction = this.testing.operationalAction;
  readonly operationalActionLoading = this.testing.operationalActionLoading;
  readonly operationalActionError = this.testing.operationalActionError;
  readonly operationalScenarioModes = this.testing.operationalScenarioModes;
  readonly operationalConfirmationOpen = this.testing.operationalConfirmationOpen;
  readonly operationalSelections = this.testing.operationalSelections;
  readonly operationalPartialCoverage = this.testing.operationalPartialCoverage;
  readonly sandboxRun = this.testing.sandboxRun;

  readonly snapshotHead = this.snapshots.snapshotHead;
  readonly snapshotHeadSet = this.snapshots.snapshotHeadSet;
  readonly snapshotHeadSetLoading = this.snapshots.snapshotHeadSetLoading;
  readonly snapshotHeadSetError = this.snapshots.snapshotHeadSetError;
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
    this.snapshotHead(),
    this.snapshotHeadSet()
  ));
  readonly executionCorrelation = computed(() => buildExecutionCorrelationSummary(
    this.selected(),
    this.lifecycle(),
    this.snapshotHead(),
    this.executionSummary(),
    this.hostStatusSummary(),
    this.snapshotHeadSet()
  ));

  constructor(readonly i18n: PolicyStudioI18n) {
    this.shell.registerLogoutHandler(() => this.logout());
    this.shell.registerThemeToggleHandler(() => this.theme.toggleDark());
    this.shell.registerSessionReaders(() => this.sessionActive(), () => this.signingOut());
    this.shell.registerDarkThemeReader(() => this.theme.isDark());
    this.destroyRef.onDestroy(() => {
      this.shell.registerLogoutHandler(null);
      this.shell.registerThemeToggleHandler(null);
      this.shell.registerSessionReaders(null, null);
      this.shell.registerDarkThemeReader(null);
    });
  }

  setInspectorTab(tab: StudioInspectorTab): void {
    this.shell.openInspectorTab(tab);
  }

  enableTechnicalView(): void {
    this.shell.setViewDepth('technical');
  }

  setBusinessTrack(): void {
    this.shell.setWorkspaceTrack('business');
  }

  openAccessPrivacyForCurrentDecision(): void {
    const current = this.selected();
    if (!current) {
      this.shell.setWorkspaceTrack('authorization');
      return;
    }
    const resourceKey =
      current.resourceKey?.trim() ||
      current.ruleSetKey?.trim() ||
      current.domain?.trim() ||
      current.key;
    const posture = this.maturityPosture();
    this.shell.openAccessBridge({
      resourceKey,
      serviceKey: current.serviceKey?.trim() || null,
      domainLabel: this.displayHeaderDomain(current),
      ruleTitle: this.displayCanvasTitle(current),
      decisionKey: current.key,
      sensitiveFactsCount: posture?.sensitiveFactsCount ?? 0
    });
  }

  selectDecisionFromPalette(decision: DecisionSummary): void {
    this.shell.setWorkspaceTrack('business');
    this.shell.closeCommandPalette();
    this.activeRuleTypeFilter.set(null);
    if (!this.decisions().some(item => item.key === decision.key)) {
      this.contextScopeFilter.set(null);
    }
    this.select(decision, false, true);
  }

  selectScopeFromPalette(scopeKey: string): void {
    this.shell.setWorkspaceTrack('business');
    this.shell.closeCommandPalette();
    this.applyScopeFilter(scopeKey);
  }

  handleCommandPaletteAction(actionId: CommandPaletteActionId): void {
    this.shell.closeCommandPalette();
    switch (actionId) {
      case 'open-portfolio':
        this.shell.setWorkspaceTrack('business');
        if (this.allDecisions().length > 1) {
          this.portfolioOverviewOpen.set(true);
          this.narrowDetailOpen.set(true);
        }
        return;
      case 'toggle-depth':
        this.shell.toggleViewDepth();
        return;
      case 'open-access-privacy':
        this.openAccessPrivacyForCurrentDecision();
        return;
      case 'open-ai':
        this.shell.setWorkspaceTrack('business');
        this.setInspectorTab('ai');
        return;
      case 'toggle-theme':
        this.shell.toggleTheme();
        return;
      case 'nav-understand':
        this.jumpToRuleSection('decision-overview');
        return;
      case 'nav-rule':
        this.jumpToRuleSection('decision-rule');
        return;
      case 'nav-test':
        this.jumpToRuleSection('decision-tests');
        return;
      case 'nav-operate':
        this.jumpToRuleSection('decision-execution');
        return;
      case 'nav-history':
        this.jumpToRuleSection('decision-history');
        return;
    }
  }

  private jumpToRuleSection(sectionId: string): void {
    this.shell.setWorkspaceTrack('business');
    this.portfolioOverviewOpen.set(false);
    this.narrowDetailOpen.set(true);
    this.navigateToSection(sectionId);
  }

  ngOnInit(): void {
    this.route?.queryParamMap
      .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const hasScopeParam = params.has('tenantId') || params.has('organizationId') || params.has('environment');
        if (!hasScopeParam) return;
        const nextTenantId = params.get('tenantId')?.trim() || null;
        const nextOrganizationId = params.get('organizationId')?.trim() || null;
        const nextEnvironment = params.get('environment')?.trim() || null;
        const current = this.hostScope.scope();
        if (
          nextTenantId === current.tenantId
          && nextOrganizationId === current.organizationId
          && nextEnvironment === current.environment
        ) {
          return;
        }
        this.hostScope.setScope({
          tenantId: nextTenantId,
          organizationId: nextOrganizationId,
          environment: nextEnvironment
        });
        this.loadCatalog();
      });
    this.loadCatalog();
  }

  meaningText(decision: DecisionSummary): string {
    if (decision.meaning.trim() && decision.meaning.trim() !== decision.name.trim()) return decision.meaning;
    return `${this.i18n.text('decisionInDecisionSet')} ${decision.ruleSet}.`;
  }

  displayHeaderDomain(decision: DecisionSummary): string {
    const raw = decision.domain?.trim() || this.i18n.text('selected');
    if (this.viewDepth() === 'technical' || !looksLikeTechnicalSlug(raw)) return raw;
    return humanizeTechnicalSlug(raw, 2, this.i18n.locale()) || raw;
  }

  displayDecisionTitle(decision: DecisionSummary): string {
    return humanizeDecisionTitle(
      decision.name,
      decision.code,
      this.effectiveDocumentation(decision)?.title,
      this.viewDepth(),
      this.i18n.locale()
    );
  }

  displayCanvasTitle(decision: DecisionSummary): string {
    if (this.viewDepth() === 'business') {
      const docTitle = this.effectiveDocumentation(decision)?.title?.trim();
      if (docTitle && !looksLikeTechnicalSlug(docTitle)) {
        return docTitle;
      }
    }
    return this.displayDecisionTitle(decision);
  }

  displayCanvasSubtitle(decision: DecisionSummary): string | null {
    if (this.viewDepth() !== 'business') return null;
    const heroTitle = this.displayCanvasTitle(decision);
    const ruleName = this.displayDecisionTitle(decision);
    const normalize = (value: string): string =>
      value.trim().replace(/\.+$/, '').replace(/\s+/g, ' ').toLowerCase();
    return normalize(heroTitle) !== normalize(ruleName) ? ruleName : null;
  }

  showStandaloneMeaning(decision: DecisionSummary): boolean {
    const normalize = (value: string | null | undefined): string =>
      (value ?? '').trim().replace(/\.+$/, '').replace(/\s+/g, ' ').toLowerCase();
    const lead = normalize(this.meaningText(decision));
    if (!lead) return false;
    const title = normalize(this.displayCanvasTitle(decision));
    const subtitle = normalize(this.displayCanvasSubtitle(decision));
    const didacticSummary = normalize(this.effectiveDocumentation(decision)?.summary ?? this.meaningText(decision));
    return lead !== title && lead !== subtitle && lead !== didacticSummary;
  }

  policyGlossary(decision: DecisionSummary): StudioGlossaryEntry {
    return resolvePolicyGlossaryEntry(decision.slotOverridePolicy, this.i18n.locale());
  }

  policyBadgeTone(decision: DecisionSummary): 'info' | 'success' | 'locked' {
    switch (decision.slotOverridePolicy) {
      case 'PARAMETERIZABLE':
        return 'info';
      case 'RESTRICT_ONLY':
      case 'EXTEND_ONLY':
      case 'REPLACEABLE':
        return 'success';
      default:
        return 'locked';
    }
  }

  private resolvedGovernanceStatusCode(
    decision: DecisionSummary
  ): 'PROMOTED' | 'APPROVED' | 'SUBMITTED' | 'REJECTED' | 'OPEN' {
    const posture = this.maturityPosture();
    if (posture?.operationalAuthority === 'CONFIG_ACTIVE_SNAPSHOT') {
      return 'PROMOTED';
    }
    switch (posture?.approvalStage) {
      case 'PROMOTED_READY':
        return 'PROMOTED';
      case 'APPROVED':
        return 'APPROVED';
      case 'IN_REVIEW':
        return 'SUBMITTED';
      case 'REJECTED':
        return 'REJECTED';
      default:
        return decision.state === 'verified' ? 'PROMOTED' : 'OPEN';
    }
  }

  statusGlossary(decision: DecisionSummary): StudioGlossaryEntry {
    const locale = this.i18n.locale();
    const code = this.resolvedGovernanceStatusCode(decision);
    const base = resolveStatusGlossaryEntry(code, locale);
    if (code === 'PROMOTED' && decision.workspaceStatus?.toUpperCase() === 'OPEN') {
      return { ...base, detail: this.i18n.text('parallelDraftNote') };
    }
    return base;
  }

  statusBadgeTone(decision: DecisionSummary): 'success' | 'info' | 'warning' | 'default' {
    switch (this.resolvedGovernanceStatusCode(decision)) {
      case 'PROMOTED':
        return 'success';
      case 'APPROVED':
        return 'info';
      case 'SUBMITTED':
      case 'REJECTED':
        return 'warning';
      default:
        return 'default';
    }
  }

  isCreateDraftPrimary(decision: DecisionSummary): boolean {
    return Boolean(
      (!decision.workspaceId ||
        decision.workspaceStatus === 'PROMOTED' ||
        decision.workspaceStatus === 'REJECTED') &&
        decision.authoringSupported &&
        this.hasDefinitionAction('CREATE_NEW_VERSION')
    );
  }

  policyIconName(decision: DecisionSummary): StudioIconName {
    switch (decision.slotOverridePolicy) {
      case 'PARAMETERIZABLE':
        return 'sliders';
      case 'RESTRICT_ONLY':
      case 'EXTEND_ONLY':
      case 'REPLACEABLE':
        return 'pencil';
      case 'FORBIDDEN':
      case 'LOCKED':
        return 'lock';
      default:
        return 'shield-check';
    }
  }

  statusIconName(decision: DecisionSummary): StudioIconName {
    switch (this.resolvedGovernanceStatusCode(decision)) {
      case 'PROMOTED':
        return 'check-circle';
      case 'APPROVED':
        return 'shield-check';
      case 'SUBMITTED':
        return 'clock';
      case 'REJECTED':
        return 'x';
      default:
        return 'file-edit';
    }
  }

  canShowNextStepEdit(decision: DecisionSummary): boolean {
    return Boolean(
      !this.isCreateDraftPrimary(decision) &&
        decision.workspaceId &&
        decision.authoringSupported &&
        this.hasWorkspaceAction('VIEW') &&
        this.canOpenAuthoring(decision)
    );
  }

  canShowNextStepCreateDraft(decision: DecisionSummary): boolean {
    return Boolean(
      (!decision.workspaceId ||
        decision.workspaceStatus === 'PROMOTED' ||
        decision.workspaceStatus === 'REJECTED') &&
        decision.authoringSupported &&
        this.hasDefinitionAction('CREATE_NEW_VERSION') &&
        (decision.promotedDefinitionId ?? decision.configDefinitionId)
    );
  }

  scenarioCountHint(count: number): string {
    const unit =
      count === 1 ? this.i18n.text('navScenarioSingular') : this.i18n.text('savedScenarios');
    return `${count} ${unit}`;
  }

  evidenceCountHint(count: number): string {
    const unit =
      count === 1 ? this.i18n.text('navEvidenceSingular') : this.i18n.text('packageReferences');
    return `${count} ${unit}`;
  }

  governanceTerm(key: StudioGovernanceTermKey): StudioGlossaryEntry {
    return resolveGovernanceGlossaryEntry(key, this.i18n.locale());
  }

  isNextStepEditable(decision: DecisionSummary): boolean {
    return (
      decision.slotOverridePolicy === 'RESTRICT_ONLY' ||
      decision.slotOverridePolicy === 'EXTEND_ONLY' ||
      decision.slotOverridePolicy === 'REPLACEABLE'
    );
  }

  isNextStepParameterizable(decision: DecisionSummary): boolean {
    return decision.slotOverridePolicy === 'PARAMETERIZABLE';
  }

  nextStepBodyParts(decision: DecisionSummary): { readonly beforeDraft: string; readonly betweenDraftAndFourEyes: string; readonly afterFourEyes: string } {
    const template = this.isNextStepEditable(decision)
      ? this.i18n.text('nextStepEditableBody')
      : this.i18n.text('nextStepParameterizableBody');
    const [beforeDraft = '', rest = ''] = template.split('{draft}');
    const [betweenDraftAndFourEyes = '', afterFourEyes = ''] = rest.split('{fourEyes}');
    return { beforeDraft, betweenDraftAndFourEyes, afterFourEyes };
  }

  evaluatedParameterEntries(decision: DecisionSummary): readonly RuleParameterDisplayEntry[] {
    return buildRuleParameterDisplayEntries(
      decision,
      this.effectiveParameters(decision),
      this.i18n.locale(),
      this.i18n.text('paramDefaultPrefix')
    );
  }

  customizedParameterEntries(decision: DecisionSummary): readonly RuleParameterDisplayEntry[] {
    return this.evaluatedParameterEntries(decision).filter(entry => entry.isCustomized);
  }

  customizedParametersDetail(decision: DecisionSummary): string | null {
    const items = this.customizedParameterEntries(decision);
    if (items.length === 0) {
      return null;
    }
    return items
      .map(entry =>
        entry.defaultHint ? `${entry.label}: ${entry.valueText} (${entry.defaultHint})` : `${entry.label}: ${entry.valueText}`
      )
      .join(' · ');
  }

  displayFactLabel(fact: DecisionFact): string {
    const raw = fact.label?.trim() ?? '';
    if (!raw || this.viewDepth() === 'technical') {
      return raw || fact.path;
    }
    const stripped = raw.replace(/^(draft|tenant|context|record|subject)\s*:\s*/i, '').trim() || raw;
    const isCamelCaseIdentifier = !/\s/.test(stripped) && /[a-z][A-Z]/.test(stripped);
    return looksLikeTechnicalSlug(stripped) || isCamelCaseIdentifier
      ? humanizeTechnicalSlug(stripped, undefined, this.i18n.locale())
      : stripped;
  }

  factSummaryForPopover(fact: DecisionFact): string {
    const desc = fact.description?.trim() || humanizeTechnicalSlug(fact.path, undefined, this.i18n.locale());
    const reqLabel = this.i18n.text(fact.nullable ? 'factNullable' : 'factRequired');
    return `${desc} (${reqLabel} · ${fact.valueType})`;
  }

  factDetailForPopover(fact: DecisionFact): string {
    return `Path: ${fact.path} · ${fact.sensitivity}`;
  }

  effectiveDocumentation(decision: DecisionSummary | null | undefined): RuleDocumentationDescriptor | null {
    return this.authoring.effectiveDocumentation(decision);
  }

  hasCompleteDidacticDocumentation(doc: RuleDocumentationDescriptor | null): boolean {
    if (!doc) return false;
    return Boolean(
      doc.summary?.trim()
      && doc.whenApplies?.trim()
      && doc.rationale?.trim()
      && doc.customizationGuidance?.trim()
    );
  }

  customizationGuidanceFallback(decision: DecisionSummary): string {
    switch (decision.slotOverridePolicy) {
      case 'FORBIDDEN':
      case 'LOCKED':
        return this.i18n.text('customizationGuidanceFallbackForbidden');
      case 'PARAMETERIZABLE':
        return this.i18n.text('customizationGuidanceFallbackParameterizable');
      case 'RESTRICT_ONLY':
        return this.i18n.text('customizationGuidanceFallbackRestrictOnly');
      case 'EXTEND_ONLY':
        return this.i18n.text('customizationGuidanceFallbackExtendOnly');
      case 'REPLACEABLE':
        return this.i18n.text('customizationGuidanceFallbackReplaceable');
      default:
        return this.i18n.text('customizationGuidanceFallbackDefault');
    }
  }

  safeLegalBasisUrl(url: string | null | undefined): string | null {
    return isSafeLegalBasisUrl(url) ? url!.trim() : null;
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
    if (value === 'PROMOTED_READY') {
      return this.i18n.text(
        this.viewDepth() === 'business' ? 'approvalStagePromotedBusiness' : 'approvalStagePromoted'
      );
    }
    if (value === 'APPROVED') return this.i18n.text('approvalStageApproved');
    if (value === 'IN_REVIEW') return this.i18n.text('approvalStageInReview');
    if (value === 'REJECTED') return this.i18n.text('approvalStageRejected');
    return this.i18n.text('approvalStageDraft');
  }

  operationalAuthorityPostureLabel(value: DecisionMaturityPosture['operationalAuthority']): string {
    if (value === 'CONFIG_ACTIVE_SNAPSHOT') {
      return this.i18n.text(
        this.viewDepth() === 'business'
          ? 'authorityActiveSnapshotBusiness'
          : 'authorityActiveSnapshot'
      );
    }
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
        this.signingOut.set(false);
        this.shell.syncSessionState(state.config.mode === 'remote', false);
        this.logoutFailed.set(false);
        this.portfolioOverviewOpen.set(false);
        this.activeRuleTypeFilter.set(null);
        this.allDecisions.set(decisions);
        this.contextScopeFilter.set(this.resolveDeepLinkScopeFilter(decisions));
        const initial = this.resolveInitialDecision(decisions, state.config.initialDecisionKey);
        const initialOperationKey = this.resolveInitialOperationKey();
        if (initial) this.select(initial, true, this.hasExplicitDeepLink(), false, initialOperationKey);
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
          this.shell.syncSessionState(false, false);
          this.authenticationRequired.set(true);
        } else if (error instanceof HttpErrorResponse && error.status === 403) {
          this.resolveForbiddenResponse(state.config, loadRevision);
        }
      }
    });
  }

  resolveInitialDecision(
    decisions: readonly DecisionSummary[],
    configuredInitialKey: string | null
  ): DecisionSummary | null {
    if (!decisions.length) return null;
    if (typeof window !== 'undefined' && window.location?.search) {
      const params = new URLSearchParams(window.location.search);
      const requestedDecisionKey = params.get('decisionKey')?.trim() || null;
      const requestedBindingKey = params.get('bindingKey')?.trim() || null;
      const requestedSlotKey = params.get('slotKey')?.trim() || null;
      const requestedRuleSetKey = params.get('ruleSetKey')?.trim() || null;
      const requestedResourceKey = params.get('resourceKey')?.trim() || null;

      const matchesSlot = (item: DecisionSummary, slotKey: string): boolean =>
        item.slotKey === slotKey || item.key === slotKey || item.key.startsWith(`${slotKey}.`);

      if (requestedDecisionKey) {
        const matchByDecisionKey = decisions.find(
          item => item.key === requestedDecisionKey || item.code === requestedDecisionKey
        );
        if (matchByDecisionKey) return matchByDecisionKey;
      }
      if (requestedBindingKey) {
        const matchByBindingKey = decisions.find(
          item => item.key === requestedBindingKey || item.code === requestedBindingKey
        );
        if (matchByBindingKey) return matchByBindingKey;
      }
      if (requestedRuleSetKey && requestedSlotKey) {
        const matchByRuleSetAndSlot = decisions.find(
          item => item.ruleSetKey === requestedRuleSetKey && matchesSlot(item, requestedSlotKey)
        );
        if (matchByRuleSetAndSlot) return matchByRuleSetAndSlot;
      }
      if (requestedResourceKey && requestedSlotKey) {
        const matchByResourceAndSlot = decisions.find(
          item =>
            (item.resourceKey === requestedResourceKey || item.ruleSetKey === requestedResourceKey)
            && matchesSlot(item, requestedSlotKey)
        );
        if (matchByResourceAndSlot) return matchByResourceAndSlot;
      }
      if (requestedSlotKey) {
        const matchBySlot = decisions.find(item => matchesSlot(item, requestedSlotKey));
        if (matchBySlot) return matchBySlot;
      }
      if (requestedRuleSetKey) {
        const matchByRuleSet = decisions.find(
          item => item.ruleSetKey === requestedRuleSetKey || item.resourceKey === requestedRuleSetKey
        );
        if (matchByRuleSet) return matchByRuleSet;
      }
      if (requestedResourceKey) {
        const matchByResource = decisions.find(
          item => item.resourceKey === requestedResourceKey || item.ruleSetKey === requestedResourceKey
        );
        if (matchByResource) return matchByResource;
      }
    }
    return decisions.find(item => item.key === configuredInitialKey) ?? decisions[0] ?? null;
  }

  private hasExplicitDeepLink(): boolean {
    if (typeof window === 'undefined' || !window.location?.search) return false;
    const params = new URLSearchParams(window.location.search);
    return Boolean(
      params.get('decisionKey')?.trim() ||
        params.get('bindingKey')?.trim() ||
        params.get('slotKey')?.trim() ||
        params.get('ruleSetKey')?.trim() ||
        params.get('resourceKey')?.trim()
    );
  }

  private resolveInitialOperationKey(): string | null {
    if (typeof window === 'undefined' || !window.location?.search) return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('operationKey')?.trim() || null;
  }

  private resolveDeepLinkScopeFilter(decisions: readonly DecisionSummary[]): string | null {
    if (typeof window === 'undefined' || !window.location?.search || !decisions.length) return null;
    const params = new URLSearchParams(window.location.search);
    const scope = params.get('ruleSetKey')?.trim() || params.get('resourceKey')?.trim() || null;
    if (!scope) return null;
    const matches = decisions.some(
      item => item.ruleSetKey === scope || item.resourceKey === scope || item.domain === scope
    );
    return matches ? scope : null;
  }

  private resolveForbiddenResponse(config: PolicyStudioRuntimeConfig, catalogRevision: number): void {
    this.auth.hasSession(config).subscribe({
      next: active => {
        if (catalogRevision !== this.store.catalogLoadRevision) return;
        this.sessionActive.set(active);
        this.shell.syncSessionState(active, this.signingOut());
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
    this.shell.syncSessionState(true, true);
    this.logoutFailed.set(false);
    this.auth.logout(state.config).subscribe({
      next: () => {
        ++this.store.catalogLoadRevision;
        this.signingOut.set(false);
        this.sessionActive.set(false);
        this.shell.syncSessionState(false, false);
        this.catalog.invalidateCatalogMetaCache?.();
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
        this.shell.syncSessionState(this.sessionActive(), false);
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
    this.shell.syncSessionState(false, false);
    this.authenticationRequired.set(true);
  }

  updateQuery(value: string): void { this.query.set(value); }

  filterByOntologyRoot(root: string): void {
    this.query.set(root.trim());
  }

  clearQuery(): void {
    this.query.set('');
    requestAnimationFrame(() => this.host.nativeElement.querySelector<HTMLInputElement>('.search input')?.focus());
  }

  clearContextScopeFilter(): void {
    this.contextScopeFilter.set(null);
    this.activeRuleTypeFilter.set(null);
    if (this.allDecisions().length > 1) {
      this.portfolioOverviewOpen.set(true);
      this.narrowDetailOpen.set(true);
    }
  }

  applyScopeFilter(scopeKey: string): void {
    const normalized = scopeKey.trim();
    if (!normalized) return;
    this.contextScopeFilter.set(normalized);
    this.activeRuleTypeFilter.set(null);
    this.portfolioOverviewOpen.set(false);
    const matching = this.decisions();
    const current = this.selected();
    if (matching.length > 0 && (!current || !matching.some(item => item.key === current.key))) {
      this.select(matching[0]!, false, true);
    }
  }

  applyRuleTypeFilter(ruleType: string): void {
    const normalized = ruleType.trim();
    if (!normalized) return;
    this.contextScopeFilter.set(null);
    this.activeRuleTypeFilter.set(normalized);
    this.explorerGlobalLens.set('type');
    this.portfolioOverviewOpen.set(false);
    const matching = this.decisions();
    const current = this.selected();
    if (matching.length > 0 && (!current || !matching.some(item => item.key === current.key))) {
      this.select(matching[0]!, false, true);
    }
  }

  clearRuleTypeFilter(): void {
    this.activeRuleTypeFilter.set(null);
  }

  setExplorerGlobalLens(lens: ExplorerGlobalLens): void {
    this.explorerGlobalLens.set(lens);
  }

  togglePortfolioOverview(): void {
    const next = !this.portfolioOverviewOpen();
    this.portfolioOverviewOpen.set(next);
    if (next) {
      this.narrowDetailOpen.set(true);
    }
  }

  closePortfolioOverview(): void {
    this.portfolioOverviewOpen.set(false);
    if (!this.selected() && this.decisions().length > 0) {
      this.select(this.decisions()[0]!, false, true);
    }
  }

  openWorkflowQueueInExplorer(): void {
    this.contextScopeFilter.set(null);
    this.activeRuleTypeFilter.set(null);
    this.explorerGlobalLens.set('workflow');
    this.portfolioOverviewOpen.set(false);
    this.narrowDetailOpen.set(false);
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
    this.ensureModeDataLoaded(mode);
    requestAnimationFrame(() => {
      const target = this.host.nativeElement.querySelector<HTMLElement>(`#${sectionId}`);
      if (!target) return;
      target.focus({ preventScroll: true });
    });
  }

  private ensureModeDataLoaded(mode: DecisionWorkMode): void {
    if (this.loadedModesForSelection.has(mode)) return;
    this.loadedModesForSelection.add(mode);
    const selectionRevision = this.store.selectionRevision;
    if (mode === 'test') {
      this.loadOperationalTestAction(selectionRevision);
    } else if (mode === 'operate') {
      this.loadReviews(selectionRevision);
      this.snapshots.loadSnapshots(true);
    } else if (mode === 'history') {
      this.loadTimeline(selectionRevision);
    }
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
    this.portfolioOverviewOpen.set(false);
    this.narrowDetailOpen.set(false);
    if (this.inspectorTab() === 'ai') {
      this.shell.inspectorTab.set('properties');
    }
    requestAnimationFrame(() => {
      const search = this.host.nativeElement.querySelector<HTMLInputElement>('.search input');
      search?.scrollIntoView({ block: 'start' });
      search?.focus({ preventScroll: true });
    });
  }

  select(
    decision: DecisionSummary,
    forceReload = false,
    revealOnNarrow = true,
    discardConfirmed = false,
    initialOperationKey: string | null = null
  ): void {
    if (decision.key === this.selected()?.key && !forceReload) {
      this.portfolioOverviewOpen.set(false);
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
        () => this.select(decision, forceReload, revealOnNarrow, true, initialOperationKey));
      return;
    }
    this.portfolioOverviewOpen.set(false);
    const selectionRevision = ++this.store.selectionRevision;
    this.loadedModesForSelection.clear();
    this.loadedModesForSelection.add('understand');
    this.selected.set(decision);
    this.narrowDetailOpen.set(revealOnNarrow);
    this.activeMode.set('understand');
    this.timeline.set([]);
    this.authoring.resetForSelection(decision);
    this.testing.resetForSelection();
    this.snapshots.resetForSelection();
    if (initialOperationKey && decision.operationKeys.includes(initialOperationKey)) {
      this.snapshots.snapshotOperationKey.set(initialOperationKey);
    }
    this.loadLifecycle(selectionRevision);
    this.loadScenarios(selectionRevision);
    this.loadWorkspaceCapabilities(selectionRevision);
    this.snapshots.loadSnapshots(false);
    this.hydrateSelectedDecision(decision, selectionRevision);
    this.revealSelectedDecision();
  }

  private hydrateSelectedDecision(decision: DecisionSummary, selectionRevision: number): void {
    const state = this.runtime.state();
    if (state.kind !== 'ready'
      || state.config.mode !== 'remote'
      || typeof this.catalog.loadDiscoveredCandidate !== 'function') {
      return;
    }
    const all = this.allDecisions();
    const total = Math.max(all.length, decision.totalDecisions);

    if (decision.detailHydrated === false && decision.configDefinitionId && decision.configVersion) {
      const index = Math.max(0, all.findIndex(item => item.key === decision.key));
      this.catalog.loadDiscoveredCandidate(
        {
          definitionId: decision.configDefinitionId,
          ruleKey: decision.key,
          version: decision.configVersion,
          status: decision.configStatus ?? 'draft',
          ruleType: decision.ruleType ?? 'validation',
          contextKey: decision.domain,
          resourceKey: decision.ruleSetKey || decision.resourceKey,
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
          if (hydrated.workspaceId !== decision.workspaceId) {
            this.loadLifecycle(selectionRevision);
            this.loadScenarios(selectionRevision);
            this.loadWorkspaceCapabilities(selectionRevision);
            if (this.loadedModesForSelection.has('history')) this.loadTimeline(selectionRevision);
            if (this.loadedModesForSelection.has('operate')) this.loadReviews(selectionRevision);
          }
          if (hydrated.resourceKey !== decision.resourceKey && this.loadedModesForSelection.has('test')) {
            this.loadOperationalTestAction(selectionRevision);
          }
          if (hydrated.ruleSetKey !== decision.ruleSetKey) {
            this.snapshots.loadSnapshots(this.loadedModesForSelection.has('operate'));
          }
        },
        error: error => this.store.failAuthoringCommand(error, selectionRevision, decision.key)
      });
    }

    const unhydratedSiblings = all.filter(
      item =>
        item.key !== decision.key
        && Boolean(decision.ruleSetKey)
        && item.ruleSetKey === decision.ruleSetKey
        && item.detailHydrated === false
        && Boolean(item.configDefinitionId)
        && Boolean(item.configVersion)
    );
    for (const sibling of unhydratedSiblings) {
      const siblingIndex = Math.max(0, all.findIndex(item => item.key === sibling.key));
      this.catalog.loadDiscoveredCandidate(
        {
          definitionId: sibling.configDefinitionId!,
          ruleKey: sibling.key,
          version: sibling.configVersion!,
          status: sibling.configStatus ?? 'draft',
          ruleType: sibling.ruleType ?? 'validation',
          contextKey: sibling.domain,
          resourceKey: sibling.ruleSetKey || sibling.resourceKey,
          serviceKey: sibling.serviceKey,
          semanticOwner: null,
          updatedAt: ''
        },
        siblingIndex,
        total,
        this.i18n.locale(),
        state.config
      ).subscribe({
        next: hydratedSibling => {
          if (selectionRevision !== this.store.selectionRevision) return;
          this.allDecisions.update(items =>
            items.map(item => item.key === hydratedSibling.key ? hydratedSibling : item)
          );
        },
        error: () => {
          // Sibling background hydration for DAG completeness is non-blocking
        }
      });
    }
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
        this.loadedModesForSelection.clear();
        this.loadedModesForSelection.add('understand');
        this.loadedModesForSelection.add(previousMode);
        this.selected.set(refreshed);
        this.timeline.set([]);
        this.authoring.resetForSelection(refreshed);
        this.testing.resetForSelection();
        this.snapshots.resetForSelection();
        this.activeMode.set(previousMode);
        this.loadLifecycle(selectionRevision);
        this.loadScenarios(selectionRevision);
        this.loadWorkspaceCapabilities(selectionRevision);
        this.snapshots.loadSnapshots(previousMode === 'operate');
        if (previousMode === 'history') this.loadTimeline(selectionRevision);
        if (previousMode === 'operate') this.loadReviews(selectionRevision);
        if (previousMode === 'test') this.loadOperationalTestAction(selectionRevision);
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
    this.ensureModeDataLoaded('rule');
    requestAnimationFrame(() => this.host.nativeElement.querySelector<HTMLElement>('.draft-workspace')?.focus({ preventScroll: true }));
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

  updateDraftDocumentation(documentation: RuleDocumentationDescriptor | null): void {
    this.authoring.updateDraftDocumentation(documentation);
  }

  applyDiffProposal(proposal: SuggestedDraftDiffProposal): void {
    this.authoring.applyDiffProposal(proposal);
  }

  autoFixDraftOntology(): void {
    this.authoring.autoFixDraftOntology();
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

  selectAllActiveOperationalScenarios(mode: 'CREATE' | 'UPDATE' = 'CREATE'): void {
    this.testing.selectAllActiveOperationalScenarios(mode);
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

  scaffoldScenarioOntology(): void {
    this.testing.scaffoldScenarioOntology();
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

  probeRollout(item: DomainRuleRolloutCatalogItem): void {
    this.snapshots.probeRollout(item);
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
