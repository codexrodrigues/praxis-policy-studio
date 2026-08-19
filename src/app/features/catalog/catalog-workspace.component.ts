import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PolicyStudioI18n } from '../../core/i18n';
import { ProjectionCatalogService } from '../../core/projection-catalog.service';
import { DecisionFact, DecisionLifecycleSummary, DecisionPublicationResult, DecisionSummary, PolicySandboxRun, PublicationReadiness } from './catalog.fixture';
import { DecisionTimelineEvent } from './catalog.fixture';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import { HttpErrorResponse } from '@angular/common/http';
import type { RuleBuilderConfig, RuleBuilderState } from '@praxisui/visual-builder';
import { LocalDraftWorkspaceComponent } from '../authoring/local-draft-workspace.component';
import { canonicalDecisionExpression, composeDecisionCondition, editableDecisionCondition, formatDecisionExpression } from '../../core/decision-inspection';
import { AuthSessionService } from '../../core/auth-session.service';
import { PolicyStudioRuntimeConfig } from '../../core/runtime-config';
import {
  API_URL,
  DomainRuleService,
  ResourceDiscoveryService,
  isDomainRuleSnapshotProblemResponse,
  type ApiUrlConfig,
  type DomainRuleChangeWorkspace,
  type DomainRuleDecision,
  type DomainRuleDefinitionAction,
  type DomainRuleExecutionSummary,
  type DomainRuleHostStatusSummary,
  type DomainRuleRolloutPolicy,
  type DomainRuleRolloutPolicyCatalog,
  type DomainRuleRolloutPolicyCreateRequest,
  type DomainRuleRolloutPolicyEvent,
  type DomainRuleRolloutCatalog,
  type DomainRuleRolloutCatalogItem,
  type DomainRuleSnapshotHeadStatus,
  type DomainRuleSnapshotBlocker,
  type DomainRuleSnapshotVersion,
  type DomainRuleTestScenario,
  type DomainRuleWorkspaceAction,
  type DomainRuleWorkspaceCapabilities,
  type DomainRuleWorkspaceReview,
  type ResourceActionCatalogItem
} from '@praxisui/core';
import { semanticDecisionDiff } from '../../core/semantic-decision-diff';
import { SnapshotCockpitComponent } from './snapshot-cockpit.component';
import { forkJoin } from 'rxjs';
import { DecisionExplanationComponent } from './decision-explanation.component';
import { DecisionDiscoveryComponent } from './decision-discovery.component';
import { createClientRequestId } from '../../core/client-request-id';

interface PendingOperationalCommand {
  readonly workspaceId: string;
  readonly selectionFingerprint: string;
  readonly idempotencyKey: string;
  readonly evaluatedAtUtc: string;
}

type DecisionWorkMode = 'understand' | 'rule' | 'test' | 'operate' | 'history';

@Component({
  selector: 'pax-catalog-workspace',
  imports: [
    FormsModule,
    LocalDraftWorkspaceComponent,
    SnapshotCockpitComponent,
    DecisionExplanationComponent,
    DecisionDiscoveryComponent
  ],
  providers: [
    ProjectionCatalogService,
    DomainRuleService,
    ResourceDiscoveryService,
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
  readonly query = signal('');
  readonly allDecisions = signal<readonly DecisionSummary[]>([]);
  readonly selected = signal<DecisionSummary | null>(null);
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
  readonly authoringOpen = signal(false);
  readonly authoringBusy = signal(false);
  readonly authoringError = signal(false);
  readonly authoringFeedback = signal<string | null>(null);
  readonly scenarios = signal<readonly DomainRuleTestScenario[]>([]);
  readonly scenarioFactDraft = signal<Readonly<Record<string, unknown>>>({});
  readonly scenarioFactsFallback = signal('{}');
  readonly scenarioFactsJson = computed(() => JSON.stringify(this.scenarioFactsPayload(), null, 2));
  readonly activeScenarios = computed(() => this.scenarios().filter(item => item.status === 'ACTIVE'));
  readonly editingScenarioId = signal<string | null>(null);
  readonly reviews = signal<readonly DomainRuleWorkspaceReview[]>([]);
  readonly reviewRationaleValue = signal('');
  readonly workspaceCapabilities = signal<DomainRuleWorkspaceCapabilities | null>(null);
  readonly workspaceCapabilitiesLoading = signal(false);
  readonly workspaceCapabilitiesError = signal(false);
  readonly operationalAction = signal<ResourceActionCatalogItem | null>(null);
  readonly operationalActionLoading = signal(false);
  readonly operationalActionError = signal(false);
  readonly operationalScenarioModes = signal<Readonly<Record<string, 'CREATE' | 'UPDATE' | ''>>>({});
  readonly operationalConfirmationOpen = signal(false);
  readonly operationalSelections = computed(() => this.scenarios().flatMap(scenario => {
    const operationMode = this.operationalScenarioModes()[scenario.id];
    return operationMode === 'CREATE' || operationMode === 'UPDATE'
      ? [{ scenarioId: scenario.id, operationMode }]
      : [];
  }));
  readonly sandboxRun = signal<PolicySandboxRun | null>(null);
  readonly publicationReadiness = signal<PublicationReadiness | null>(null);
  readonly publicationResult = signal<DecisionPublicationResult | null>(null);
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
  private catalogLoadRevision = 0;
  private selectionRevision = 0;
  private timelineLoadRevision = 0;
  private lifecycleLoadRevision = 0;
  private scenariosLoadRevision = 0;
  private reviewsLoadRevision = 0;
  private workspaceCapabilitiesLoadRevision = 0;
  private operationalActionLoadRevision = 0;
  private snapshotLoadRevision = 0;
  private rolloutPolicyLoadRevision = 0;
  private rolloutLoadRevision = 0;
  private hostStatusLoadRevision = 0;
  private executionSummaryLoadRevision = 0;
  private sandboxIdempotencyKey: string | null = null;
  private sandboxEvaluatedAtUtc: string | null = null;
  private pendingOperationalCommand: PendingOperationalCommand | null = null;
  readonly draftCondition = signal<unknown | null>(null);
  readonly editorState = signal<RuleBuilderState | null>(null);
  readonly originalExpression = computed(() => formatDecisionExpression(this.selected()?.condition));
  readonly draftExpression = computed(() => formatDecisionExpression(this.draftCondition()));
  readonly editorCondition = computed(() => editableDecisionCondition(this.draftCondition()));
  readonly draftChanged = computed(() => canonicalDecisionExpression(
    this.selected()?.workspaceCondition ?? this.selected()?.condition) !==
    canonicalDecisionExpression(this.draftCondition()));
  readonly semanticDiff = computed(() => semanticDecisionDiff(
    this.selected()?.condition,
    this.selected()?.workspaceCondition ?? this.draftCondition()
  ));
  readonly editorConfig = computed<RuleBuilderConfig | null>(() => {
    const decision = this.selected();
    if (!decision) return null;
    return {
      fieldSchemas: Object.fromEntries(decision.facts.map(fact => [fact.path, {
        name: fact.path,
        label: fact.label,
        type: fact.valueType,
        description: fact.description,
        required: !fact.nullable,
        origin: 'field'
      }])),
      ui: { showAdvanced: false, enableDragDrop: true, showInlineErrors: true },
      validation: { realTime: true, strictness: 'strict' }
    };
  });
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

  constructor(readonly i18n: PolicyStudioI18n) {}

  ngOnInit(): void {
    this.loadCatalog();
  }

  loadCatalog(): void {
    const loadRevision = ++this.catalogLoadRevision;
    const state = this.runtime.state();
    if (state.kind !== 'ready') return;
    this.loading.set(true);
    this.i18n.locale.set(state.config.locale);
    this.loadError.set(null);
    this.authenticationRequired.set(false);
    this.permissionLimited.set(false);
    this.catalog.load(this.i18n.locale(), state.config).subscribe({
      next: decisions => {
        if (loadRevision !== this.catalogLoadRevision) return;
        this.authenticationFailed.set(false);
        this.sessionActive.set(state.config.mode === 'remote');
        this.logoutFailed.set(false);
        this.allDecisions.set(decisions);
        const initial = decisions.find(item => item.key === state.config.initialDecisionKey) ?? decisions[0] ?? null;
        if (initial) this.select(initial, true);
        else this.clearSelection();
        this.loading.set(false);
      },
      error: (error: unknown) => {
        if (loadRevision !== this.catalogLoadRevision) return;
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
        if (catalogRevision !== this.catalogLoadRevision) return;
        this.sessionActive.set(active);
        active ? this.permissionLimited.set(true) : this.authenticationRequired.set(true);
      },
      error: () => {
        if (catalogRevision !== this.catalogLoadRevision) return;
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
        ++this.catalogLoadRevision;
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

  /**
   * Makes the authentication form available without assuming that an opaque
   * catalog failure was caused by credentials. A successful sign-in replaces
   * the browser's prior local development session.
   */
  requestAuthentication(): void {
    ++this.catalogLoadRevision;
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
  select(decision: DecisionSummary, forceReload = false): void {
    if (decision.key === this.selected()?.key && !forceReload) return;
    if ((forceReload || decision.key !== this.selected()?.key) && !this.confirmDraftDiscard()) return;
    const selectionRevision = ++this.selectionRevision;
    this.selected.set(decision);
    this.activeMode.set('understand');
    this.authoringOpen.set(false);
    this.draftCondition.set(decision.condition);
    this.editorState.set(null);
    this.timeline.set([]);
    this.sandboxRun.set(null);
    this.sandboxIdempotencyKey = null;
    this.sandboxEvaluatedAtUtc = null;
    this.pendingOperationalCommand = null;
    this.publicationReadiness.set(null);
    this.publicationResult.set(null);
    this.authoringFeedback.set(null);
    this.authoringError.set(false);
    this.reviewRationaleValue.set('');
    this.operationalAction.set(null);
    this.operationalActionError.set(false);
    this.operationalScenarioModes.set({});
    this.editingScenarioId.set(null);
    this.operationalConfirmationOpen.set(false);
    this.snapshotFeedback.set(null);
    this.snapshotFeedbackError.set(false);
    this.snapshotBlockers.set([]);
    this.loadTimeline(selectionRevision);
    this.loadLifecycle(selectionRevision);
    this.loadScenarios(selectionRevision);
    this.loadReviews(selectionRevision);
    this.loadWorkspaceCapabilities(selectionRevision);
    this.loadOperationalTestAction(selectionRevision);
    this.loadSnapshots();
    this.revealSelectedDecision();
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

  loadSnapshots(): void {
    const loadRevision = ++this.snapshotLoadRevision;
    const state = this.runtime.state();
    const ruleSetKey = this.selected()?.ruleSetKey;
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
        if (loadRevision !== this.snapshotLoadRevision) return;
        this.snapshotHead.set(cockpit.head);
        this.snapshotVersions.set(cockpit.versions);
        this.snapshotsLoading.set(false);
        this.loadExecutionSummary(cockpit.head?.activeSnapshotKey ?? null);
        this.loadHostStatusSummary(ruleSetKey);
      },
      error: () => {
        if (loadRevision !== this.snapshotLoadRevision) return;
        this.snapshotsLoading.set(false);
        this.snapshotsError.set(true);
      }
    });
  }

  loadRolloutPolicies(
    ruleSetKey: string | null = this.selected()?.ruleSetKey ?? null
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
        if (loadRevision !== this.rolloutPolicyLoadRevision || ruleSetKey !== this.selected()?.ruleSetKey) return;
        this.rolloutPolicyCatalog.set(result.catalog);
        this.rolloutPolicyTimeline.set(result.timeline);
        this.rolloutPoliciesLoading.set(false);
      },
      error: (error: unknown) => {
        if (loadRevision !== this.rolloutPolicyLoadRevision || ruleSetKey !== this.selected()?.ruleSetKey) return;
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
    ruleSetKey: string | null = this.selected()?.ruleSetKey ?? null
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
        if (loadRevision !== this.rolloutLoadRevision || ruleSetKey !== this.selected()?.ruleSetKey) return;
        this.rolloutCatalog.set(catalog);
        this.rolloutLoading.set(false);
      },
      error: () => {
        if (loadRevision !== this.rolloutLoadRevision || ruleSetKey !== this.selected()?.ruleSetKey) return;
        this.rolloutLoading.set(false);
        this.rolloutError.set(true);
      }
    });
  }

  loadHostStatusSummary(
    ruleSetKey: string | null = this.selected()?.ruleSetKey ?? null
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
        if (loadRevision !== this.hostStatusLoadRevision || ruleSetKey !== this.selected()?.ruleSetKey) return;
        this.hostStatusSummary.set(summary);
        this.hostStatusLoading.set(false);
      },
      error: (error: unknown) => {
        if (loadRevision !== this.hostStatusLoadRevision || ruleSetKey !== this.selected()?.ruleSetKey) return;
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

  openAuthoring(): void {
    if (this.authoringOpen()) return;
    const decision = this.selected();
    if (!decision?.authoringSupported || !decision.condition || !this.hasWorkspaceAction('VIEW')) return;
    this.draftCondition.set(decision.workspaceCondition ?? decision.condition);
    this.editorState.set(null);
    this.authoringOpen.set(true);
  }

  openAuthoringAndFocus(): void {
    this.openAuthoring();
    requestAnimationFrame(() => this.host.nativeElement.querySelector<HTMLElement>('.draft-workspace')?.focus());
  }

  closeAuthoring(): void {
    if (!this.confirmDraftDiscard()) return;
    this.resetDraftState();
    this.authoringOpen.set(false);
  }
  updateDraft(condition: unknown): void {
    const source = this.selected()?.workspaceCondition ?? this.selected()?.condition;
    this.draftCondition.set(composeDecisionCondition(source, condition));
  }
  updateEditorState(state: RuleBuilderState): void { this.editorState.set(state); }
  resetDraft(): void {
    if (this.draftChanged() && !window.confirm(this.i18n.text('discardChanges'))) return;
    this.resetDraftState();
  }

  createWorkspace(): void {
    const state = this.runtime.state();
    const decision = this.selected();
    if (state.kind !== 'ready' || !decision?.configDefinitionId
      || !this.hasDefinitionAction('CREATE_NEW_VERSION') || this.authoringBusy()) return;
    this.authoringBusy.set(true);
    this.clearAuthoringMessage();
    this.catalog.createWorkspace(decision.configDefinitionId, decision.name, state.config).subscribe({
      next: workspace => {
        this.applyWorkspace(workspace);
        this.authoringBusy.set(false);
        this.authoringFeedback.set(this.i18n.text('workspaceCreated'));
        this.loadLifecycle();
      },
      error: error => this.failAuthoring(error)
    });
  }

  saveGovernedDraft(): void {
    const state = this.runtime.state();
    const decision = this.selected();
    if (state.kind !== 'ready' || !decision?.workspaceId || !decision.workspaceEtag
      || !this.hasWorkspaceAction('UPDATE_DRAFT') || this.authoringBusy()) return;
    this.authoringBusy.set(true);
    this.clearAuthoringMessage();
    this.catalog.saveWorkspaceDraft({
      id: decision.workspaceId,
      etag: decision.workspaceEtag,
      parameters: { ...(decision.workspaceParameters ?? {}) }
    }, this.draftCondition(), state.config).subscribe({
      next: workspace => {
        this.applyWorkspace(workspace);
        this.authoringBusy.set(false);
        this.authoringFeedback.set(this.i18n.text('draftSaved'));
        this.loadLifecycle();
      },
      error: error => this.failAuthoring(error)
    });
  }

  loadScenarios(selectionRevision = this.selectionRevision): void {
    const loadRevision = ++this.scenariosLoadRevision;
    const state = this.runtime.state();
    const workspaceId = this.selected()?.workspaceId;
    this.scenarios.set([]);
    if (state.kind !== 'ready' || !workspaceId) return;
    this.catalog.scenarios(workspaceId, state.config).subscribe({
      next: scenarios => {
        if (loadRevision !== this.scenariosLoadRevision || !this.isCurrentWorkspace(selectionRevision, workspaceId)) return;
        this.scenarios.set(scenarios);
      },
      error: () => {
        if (loadRevision !== this.scenariosLoadRevision || !this.isCurrentWorkspace(selectionRevision, workspaceId)) return;
        this.authoringError.set(true);
      }
    });
  }

  loadReviews(selectionRevision = this.selectionRevision): void {
    const loadRevision = ++this.reviewsLoadRevision;
    const state = this.runtime.state();
    const workspaceId = this.selected()?.workspaceId;
    this.reviews.set([]);
    this.reviewRationaleValue.set('');
    if (state.kind !== 'ready' || !workspaceId) return;
    this.catalog.reviews(workspaceId, state.config).subscribe({
      next: reviews => {
        if (loadRevision !== this.reviewsLoadRevision || !this.isCurrentWorkspace(selectionRevision, workspaceId)) return;
        this.reviews.set(reviews);
      },
      error: () => {
        if (loadRevision !== this.reviewsLoadRevision || !this.isCurrentWorkspace(selectionRevision, workspaceId)) return;
        this.authoringError.set(true);
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

  hasWorkspaceAction(action: DomainRuleWorkspaceAction): boolean {
    return this.workspaceCapabilities()?.availableActions.includes(action) ?? false;
  }

  hasDefinitionAction(action: DomainRuleDefinitionAction): boolean {
    return this.selected()?.availableDefinitionActions.includes(action) ?? false;
  }

  loadOperationalTestAction(selectionRevision = this.selectionRevision): void {
    const loadRevision = ++this.operationalActionLoadRevision;
    const state = this.runtime.state();
    const resourceKey = this.selected()?.resourceKey;
    this.operationalAction.set(null);
    this.operationalActionError.set(false);
    if (state.kind !== 'ready' || !resourceKey) {
      this.operationalActionLoading.set(false);
      return;
    }
    this.operationalActionLoading.set(true);
    this.catalog.operationalTestAction(resourceKey, state.config).subscribe({
      next: action => {
        if (loadRevision !== this.operationalActionLoadRevision
          || selectionRevision !== this.selectionRevision) return;
        this.operationalAction.set(action);
        this.operationalActionLoading.set(false);
      },
      error: () => {
        if (loadRevision !== this.operationalActionLoadRevision
          || selectionRevision !== this.selectionRevision) return;
        this.operationalActionLoading.set(false);
        this.operationalActionError.set(true);
      }
    });
  }

  setOperationalScenarioMode(scenarioId: string, value: string): void {
    const mode = value === 'CREATE' || value === 'UPDATE' ? value : '';
    this.operationalScenarioModes.update(current => ({ ...current, [scenarioId]: mode }));
    this.pendingOperationalCommand = null;
    this.operationalConfirmationOpen.set(false);
  }

  reviewOperationalTest(): void {
    if (!this.operationalAction()?.availability.allowed
      || !this.selected()?.workspaceEtag
      || !this.operationalSelections().length
      || this.authoringBusy()) return;
    this.operationalConfirmationOpen.set(true);
  }

  cancelOperationalTest(): void {
    this.operationalConfirmationOpen.set(false);
  }

  runOperationalTest(): void {
    const state = this.runtime.state();
    const decision = this.selected();
    const action = this.operationalAction();
    const selections = this.operationalSelections();
    if (state.kind !== 'ready' || !decision?.workspaceId || !decision.workspaceEtag
      || !action?.availability.allowed || !selections.length
      || !this.operationalConfirmationOpen() || this.authoringBusy()) return;
    this.authoringBusy.set(true);
    this.operationalConfirmationOpen.set(false);
    this.clearAuthoringMessage();
    const commandSelectionRevision = this.selectionRevision;
    const command = this.operationalCommand(decision.workspaceId, selections);
    this.catalog.runOperationalTest(
      action,
      decision.workspaceId,
      decision.workspaceEtag,
      selections,
      command.idempotencyKey,
      command.evaluatedAtUtc,
      state.config
    ).subscribe({
      next: receipt => {
        if (!this.isCurrentWorkspace(commandSelectionRevision, decision.workspaceId!)) {
          this.authoringBusy.set(false);
          return;
        }
        const patch = (item: DecisionSummary): DecisionSummary => item.key === decision.key
          ? { ...item, workspaceEtag: receipt.workspaceEtag, workspaceRevision: receipt.run.workspaceRevision }
          : item;
        this.allDecisions.update(items => items.map(patch));
        const current = this.selected();
        if (current?.key === decision.key) this.selected.set(patch(current));
        this.pendingOperationalCommand = null;
        this.authoringBusy.set(false);
        this.authoringFeedback.set(this.i18n.text('operationalTestCompleted'));
        this.loadLifecycle();
        this.loadWorkspaceCapabilities();
      },
      error: error => {
        if (!this.isCurrentWorkspace(commandSelectionRevision, decision.workspaceId!)) {
          this.authoringBusy.set(false);
          return;
        }
        this.failAuthoring(error);
      }
    });
  }

  private operationalCommand(
    workspaceId: string,
    selections: readonly { readonly scenarioId: string; readonly operationMode: 'CREATE' | 'UPDATE' }[]
  ): PendingOperationalCommand {
    const selectionFingerprint = [...selections]
      .sort((left, right) => left.scenarioId.localeCompare(right.scenarioId))
      .map(item => `${item.scenarioId}:${item.operationMode}`)
      .join('|');
    const pending = this.pendingOperationalCommand;
    if (pending?.workspaceId === workspaceId && pending.selectionFingerprint === selectionFingerprint) {
      return pending;
    }
    const created = {
      workspaceId,
      selectionFingerprint,
      idempotencyKey: `policy-studio:operational:${workspaceId}:${createClientRequestId()}`,
      evaluatedAtUtc: new Date().toISOString()
    } satisfies PendingOperationalCommand;
    this.pendingOperationalCommand = created;
    return created;
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
    const state = this.runtime.state();
    const workspaceId = this.selected()?.workspaceId;
    if (state.kind !== 'ready' || !workspaceId
      || !this.hasWorkspaceAction('MANAGE_SCENARIOS') || this.authoringBusy()) return;
    let facts: Record<string, unknown>;
    let expectedOutput: unknown;
    try {
      const parsed: unknown = JSON.parse(factsJson);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      facts = parsed as Record<string, unknown>;
    } catch {
      this.authoringError.set(true);
      this.authoringFeedback.set(this.i18n.text('invalidFacts'));
      return;
    }
    try {
      expectedOutput = this.optionalJson(expectedOutputJson);
    } catch {
      this.authoringError.set(true);
      this.authoringFeedback.set(this.i18n.text('invalidExpectedOutput'));
      return;
    }
    this.authoringBusy.set(true);
    this.clearAuthoringMessage();
    this.catalog.createScenario(workspaceId, {
      scenarioKey: key.trim(),
      name: name.trim(),
      facts,
      expectedDecision: expectedDecision as DomainRuleDecision,
      expectedOutput,
      expectedReasonCodes: this.assertionList(expectedReasonCodes),
      expectedEffectIntents: this.assertionList(expectedEffectIntents)
    }, state.config).subscribe({
      next: receipt => {
        this.applyWorkspace(receipt.workspace);
        this.scenarios.update(items => this.withScenario(items, receipt.scenario));
        this.sandboxIdempotencyKey = null;
        this.sandboxEvaluatedAtUtc = null;
        this.authoringBusy.set(false);
        this.authoringFeedback.set(this.i18n.text('scenarioCreated'));
        this.scenarioFactDraft.set({});
        this.scenarioFactsFallback.set('{}');
        form.reset();
        this.loadLifecycle();
      },
      error: error => this.failAuthoring(error)
    });
  }

  setScenarioFactValue(fact: DecisionFact, rawValue: string | boolean): void {
    const value = this.parseScenarioFactValue(fact, rawValue);
    this.scenarioFactDraft.update(current => ({ ...current, [fact.path]: value }));
  }

  setScenarioFactNull(fact: DecisionFact, useNull: boolean): void {
    this.scenarioFactDraft.update(current => {
      const next = { ...current };
      if (useNull) next[fact.path] = null;
      else delete next[fact.path];
      return next;
    });
  }

  scenarioFactIsNull(path: string): boolean {
    return this.scenarioFactDraft()[path] === null;
  }

  scenarioFactDisplayValue(path: string): string {
    const value = this.scenarioFactDraft()[path];
    return Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value);
  }

  scenarioFactsForSubmit(): string {
    return this.selected()?.facts.length ? this.scenarioFactsJson() : this.scenarioFactsFallback();
  }

  private parseScenarioFactValue(fact: DecisionFact, rawValue: string | boolean): unknown {
    if (fact.valueType === 'boolean') return Boolean(rawValue);
    const text = String(rawValue).trim();
    if (fact.valueType === 'number') return text === '' ? null : Number(text);
    if (fact.valueType === 'string-array' || fact.valueType === 'date-array') {
      return text.split(/[\n,]/).map(item => item.trim()).filter(Boolean);
    }
    return text;
  }

  private scenarioFactsPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    Object.entries(this.scenarioFactDraft()).forEach(([path, value]) => {
      const segments = path.split('.');
      let target = payload;
      segments.forEach((segment, index) => {
        if (index === segments.length - 1) {
          target[segment] = value;
          return;
        }
        const nested = target[segment];
        if (!nested || typeof nested !== 'object' || Array.isArray(nested)) target[segment] = {};
        target = target[segment] as Record<string, unknown>;
      });
    });
    return payload;
  }

  editScenario(scenarioId: string): void {
    if (!this.hasWorkspaceAction('MANAGE_SCENARIOS') || this.authoringBusy()) return;
    this.editingScenarioId.set(scenarioId);
    this.clearAuthoringMessage();
  }

  cancelScenarioEdit(): void {
    this.editingScenarioId.set(null);
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
    const state = this.runtime.state();
    const workspaceId = this.selected()?.workspaceId;
    if (state.kind !== 'ready' || !workspaceId || !scenario.etag
      || !this.hasWorkspaceAction('MANAGE_SCENARIOS') || this.authoringBusy()) return;
    const scenarioKey = key.trim();
    const scenarioName = name.trim();
    if (!scenarioKey || !scenarioName) {
      this.authoringError.set(true);
      this.authoringFeedback.set(this.i18n.text('scenarioIdentityRequired'));
      return;
    }
    let facts: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(factsJson);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      facts = parsed as Record<string, unknown>;
    } catch {
      this.authoringError.set(true);
      this.authoringFeedback.set(this.i18n.text('invalidFacts'));
      return;
    }
    let expectedOutput: unknown;
    try {
      expectedOutput = this.optionalJson(expectedOutputJson);
    } catch {
      this.authoringError.set(true);
      this.authoringFeedback.set(this.i18n.text('invalidExpectedOutput'));
      return;
    }
    this.authoringBusy.set(true);
    this.clearAuthoringMessage();
    this.catalog.updateScenario(workspaceId, scenario.id, {
      scenarioKey,
      name: scenarioName,
      facts,
      expectedDecision: expectedDecision as DomainRuleDecision,
      expectedOutput,
      expectedReasonCodes: this.assertionList(expectedReasonCodes),
      expectedEffectIntents: this.assertionList(expectedEffectIntents),
      status: status as 'ACTIVE' | 'DISABLED'
    }, scenario.etag, state.config).subscribe({
      next: receipt => {
        this.applyWorkspace(receipt.workspace);
        this.scenarios.update(items => this.withScenario(items, receipt.scenario));
        this.sandboxRun.set(null);
        this.sandboxIdempotencyKey = null;
        this.sandboxEvaluatedAtUtc = null;
        this.editingScenarioId.set(null);
        this.authoringBusy.set(false);
        this.authoringFeedback.set(this.i18n.text('scenarioUpdated'));
        this.loadLifecycle();
      },
      error: error => this.failAuthoring(error)
    });
  }

  scenarioExpectedOutput(scenario: DomainRuleTestScenario): string {
    return scenario.expectedOutput == null ? '' : JSON.stringify(scenario.expectedOutput, null, 2);
  }

  formatScenarioFacts(scenario: DomainRuleTestScenario): string {
    return JSON.stringify(scenario.facts, null, 2);
  }

  scenarioAssertions(values: readonly string[] | undefined): string {
    return values?.join('\n') ?? '';
  }

  private optionalJson(value: string): unknown {
    const normalized = value.trim();
    return normalized ? JSON.parse(normalized) : undefined;
  }

  private assertionList(value: string): string[] {
    return [...new Set(value.split(/[\n,]/).map(item => item.trim()).filter(Boolean))];
  }

  private withScenario(
    scenarios: readonly DomainRuleTestScenario[],
    updated: DomainRuleTestScenario
  ): readonly DomainRuleTestScenario[] {
    return scenarios.some(item => item.id === updated.id)
      ? scenarios.map(item => item.id === updated.id ? updated : item)
      : [...scenarios, updated];
  }

  runGovernedSandbox(): void {
    const state = this.runtime.state();
    const workspaceId = this.selected()?.workspaceId;
    const scenarioIds = this.activeScenarios().map(item => item.id);
    if (state.kind !== 'ready' || !workspaceId
      || !scenarioIds.length || !this.hasWorkspaceAction('RECORD_TEST_RUN') || this.authoringBusy()) return;
    this.authoringBusy.set(true);
    this.clearAuthoringMessage();
    const idempotencyKey = this.sandboxIdempotencyKey
      ??= `policy-studio:${workspaceId}:${createClientRequestId()}`;
    const evaluatedAtUtc = this.sandboxEvaluatedAtUtc ??= new Date().toISOString();
    this.catalog.runSandbox(
      workspaceId,
      scenarioIds,
      idempotencyKey,
      evaluatedAtUtc,
      state.config
    ).subscribe({
      next: run => {
        this.sandboxIdempotencyKey = null;
        this.sandboxEvaluatedAtUtc = null;
        this.sandboxRun.set(run);
        this.authoringBusy.set(false);
        this.authoringFeedback.set(this.i18n.text('sandboxCompleted'));
        this.loadLifecycle();
        this.loadWorkspaceCapabilities();
      },
      error: error => this.failAuthoring(error)
    });
  }

  submitGovernedWorkspace(): void {
    const state = this.runtime.state();
    const decision = this.selected();
    if (state.kind !== 'ready' || !decision?.workspaceId || !decision.workspaceEtag
      || !this.hasWorkspaceAction('SUBMIT') || this.authoringBusy()) return;
    this.authoringBusy.set(true);
    this.clearAuthoringMessage();
    this.catalog.submitWorkspace(decision.workspaceId, decision.workspaceEtag, state.config).subscribe({
      next: workspace => {
        this.applyWorkspace(workspace);
        this.authoringBusy.set(false);
        this.authoringFeedback.set(this.i18n.text('workspaceSubmitted'));
        this.loadLifecycle();
      },
      error: error => this.failAuthoring(error)
    });
  }

  reviewGovernedWorkspace(
    decision: 'APPROVE' | 'REJECT',
    rationale: string,
    form: HTMLFormElement
  ): void {
    const state = this.runtime.state();
    const current = this.selected();
    const normalizedRationale = rationale.trim();
    if (state.kind !== 'ready' || !current?.workspaceId || !current.workspaceEtag
      || !normalizedRationale || !this.hasWorkspaceAction('REVIEW') || this.authoringBusy()) return;
    this.authoringBusy.set(true);
    this.clearAuthoringMessage();
    this.catalog.reviewWorkspace(current.workspaceId, current.workspaceEtag, decision, normalizedRationale, state.config).subscribe({
      next: workspace => {
        this.applyWorkspace(workspace);
        this.authoringBusy.set(false);
        this.authoringFeedback.set(this.i18n.text(decision === 'APPROVE' ? 'workspaceApproved' : 'workspaceRejected'));
        this.reviewRationaleValue.set('');
        form.reset();
        this.loadReviews();
        this.loadLifecycle();
      },
      error: error => this.failAuthoring(error)
    });
  }

  promoteGovernedWorkspace(): void {
    const state = this.runtime.state();
    const current = this.selected();
    if (state.kind !== 'ready' || !current?.workspaceId || !current.workspaceEtag
      || !this.hasWorkspaceAction('PROMOTE') || this.authoringBusy()) return;
    this.authoringBusy.set(true);
    this.clearAuthoringMessage();
    this.catalog.promoteWorkspace(current.workspaceId, current.workspaceEtag, state.config).subscribe({
      next: workspace => {
        this.applyWorkspace(workspace);
        this.authoringBusy.set(false);
        this.authoringFeedback.set(this.i18n.text('workspacePromoted'));
        this.inspectPublicationReadiness();
        this.loadReviews();
        this.loadLifecycle();
      },
      error: error => this.failAuthoring(error)
    });
  }

  inspectPublicationReadiness(): void {
    const state = this.runtime.state();
    const definitionId = this.selected()?.promotedDefinitionId;
    if (state.kind !== 'ready' || !definitionId || this.authoringBusy()) return;
    this.authoringBusy.set(true);
    this.clearAuthoringMessage();
    this.catalog.inspectPublicationReadiness(definitionId, state.config).subscribe({
      next: readiness => {
        this.publicationReadiness.set(readiness);
        this.publicationResult.set(null);
        this.authoringBusy.set(false);
      },
      error: error => this.failAuthoring(error)
    });
  }

  publishGovernedDefinition(): void {
    const state = this.runtime.state();
    const definitionId = this.selected()?.promotedDefinitionId;
    if (state.kind !== 'ready' || !definitionId || this.authoringBusy()
      || this.publicationReadiness()?.readiness !== 'ready_to_publish'
      || !this.hasDefinitionAction('PUBLISH')) return;
    this.authoringBusy.set(true);
    this.clearAuthoringMessage();
    this.catalog.publishDefinition(definitionId, state.config).subscribe({
      next: publication => {
        this.publicationResult.set(publication);
        this.authoringBusy.set(false);
        this.authoringFeedback.set(this.i18n.text(
          publication.status === 'published' ? 'definitionPublished' : 'publicationBlocked'));
        this.loadLifecycle();
        this.loadTimeline();
        this.loadSnapshots();
      },
      error: error => this.failAuthoring(error)
    });
  }

  createRolloutPolicy(request: DomainRuleRolloutPolicyCreateRequest): void {
    const state = this.runtime.state();
    if (state.kind !== 'ready' || this.rolloutPolicyBusy()
      || !this.rolloutPolicyCatalog()?.availableActions.includes('CREATE_POLICY_VERSION')) return;
    this.rolloutPolicyBusy.set(true);
    this.rolloutPolicyFeedback.set(null);
    this.rolloutPolicyFeedbackError.set(false);
    this.catalog.createRolloutPolicy(request, state.config).subscribe({
      next: () => {
        this.rolloutPolicyBusy.set(false);
        this.rolloutPolicyFeedback.set(this.i18n.text('rolloutPolicyCreated'));
        this.loadRolloutPolicies();
      },
      error: error => this.failRolloutPolicyOperation(error)
    });
  }

  approveRolloutPolicy(policy: DomainRuleRolloutPolicy): void {
    const state = this.runtime.state();
    if (state.kind !== 'ready' || this.rolloutPolicyBusy()
      || !policy.availableActions.includes('APPROVE')) return;
    if (!window.confirm(`${this.i18n.text('confirmRolloutPolicyApproval')}\n${policy.policyKey} v${policy.policyVersion}`)) return;
    this.rolloutPolicyBusy.set(true);
    this.rolloutPolicyFeedback.set(null);
    this.rolloutPolicyFeedbackError.set(false);
    this.catalog.approveRolloutPolicy(policy, state.config).subscribe({
      next: () => {
        this.rolloutPolicyBusy.set(false);
        this.rolloutPolicyFeedback.set(this.i18n.text('rolloutPolicyApproved'));
        this.loadRolloutPolicies();
      },
      error: error => this.failRolloutPolicyOperation(error)
    });
  }

  activateRolloutPolicy(policy: DomainRuleRolloutPolicy): void {
    const state = this.runtime.state();
    const headEtag = this.rolloutPolicyCatalog()?.headEtag;
    if (state.kind !== 'ready' || !headEtag || this.rolloutPolicyBusy()
      || !policy.availableActions.includes('ACTIVATE')) return;
    if (!window.confirm(`${this.i18n.text('confirmRolloutPolicyActivation')}\n${policy.policyKey} v${policy.policyVersion}`)) return;
    this.rolloutPolicyBusy.set(true);
    this.rolloutPolicyFeedback.set(null);
    this.rolloutPolicyFeedbackError.set(false);
    this.catalog.activateRolloutPolicy(policy, headEtag, state.config).subscribe({
      next: () => {
        this.rolloutPolicyBusy.set(false);
        this.rolloutPolicyFeedback.set(this.i18n.text('rolloutPolicyActivated'));
        this.loadRolloutPolicies();
      },
      error: error => this.failRolloutPolicyOperation(error)
    });
  }

  createRollout(candidateSnapshotKey: string): void {
    const state = this.runtime.state();
    const headEtag = this.snapshotHead()?.headEtag;
    if (state.kind !== 'ready' || !headEtag || this.rolloutBusy()
      || !this.rolloutCatalog()?.availableActions.includes('CREATE_ROLLOUT')) return;
    if (!window.confirm(`${this.i18n.text('confirmStartRollout')}\n${candidateSnapshotKey}`)) return;
    this.rolloutBusy.set(true);
    this.clearRolloutFeedback();
    this.catalog.createRollout(candidateSnapshotKey, headEtag, state.config).subscribe({
      next: () => {
        this.rolloutBusy.set(false);
        this.rolloutFeedback.set(this.i18n.text('rolloutStarted'));
        this.loadRollouts();
      },
      error: error => this.failRolloutOperation(error)
    });
  }

  cancelRollout(item: DomainRuleRolloutCatalogItem): void {
    const state = this.runtime.state();
    if (state.kind !== 'ready' || this.rolloutBusy()
      || !item.availableActions.includes('CANCEL')) return;
    if (!window.confirm(this.i18n.text('confirmCancelRollout'))) return;
    this.rolloutBusy.set(true);
    this.clearRolloutFeedback();
    this.catalog.cancelRollout(item, state.config).subscribe({
      next: () => {
        this.rolloutBusy.set(false);
        this.rolloutFeedback.set(this.i18n.text('rolloutCancelled'));
        this.loadRollouts();
      },
      error: error => this.failRolloutOperation(error)
    });
  }

  activateRollout(item: DomainRuleRolloutCatalogItem): void {
    const state = this.runtime.state();
    if (state.kind !== 'ready' || this.rolloutBusy()
      || !item.availableActions.includes('ACTIVATE_CANDIDATE')) return;
    if (!window.confirm(`${this.i18n.text('confirmPromoteCandidate')}\n${item.rollout.candidateSnapshotKey}`)) return;
    this.rolloutBusy.set(true);
    this.clearRolloutFeedback();
    this.catalog.activateRolloutCandidate(item, state.config).subscribe({
      next: () => {
        this.rolloutBusy.set(false);
        this.rolloutFeedback.set(this.i18n.text('candidatePromoted'));
        this.loadSnapshots();
        this.loadLifecycle();
      },
      error: error => this.failRolloutOperation(error)
    });
  }

  private clearRolloutFeedback(): void {
    this.rolloutFeedback.set(null);
    this.rolloutFeedbackError.set(false);
  }

  private failRolloutOperation(error: unknown): void {
    this.rolloutBusy.set(false);
    this.rolloutFeedbackError.set(true);
    this.rolloutFeedback.set(error instanceof HttpErrorResponse && error.status === 412
      ? this.i18n.text('rolloutHeadStale')
      : this.i18n.text('rolloutOperationFailed'));
    this.loadRollouts();
  }

  operateSnapshot(version: DomainRuleSnapshotVersion): void {
    const state = this.runtime.state();
    const headEtag = this.snapshotHead()?.headEtag;
    if (state.kind !== 'ready' || !headEtag || this.snapshotBusy()
      || (version.availableAction !== 'ACTIVATE' && version.availableAction !== 'ROLLBACK')) return;
    const confirmationKey = version.availableAction === 'ROLLBACK'
      ? 'confirmSnapshotRollback'
      : 'confirmSnapshotActivation';
    if (!window.confirm(`${this.i18n.text(confirmationKey)}\n${version.snapshotKey}`)) return;
    this.snapshotBusy.set(true);
    this.snapshotFeedback.set(null);
    this.snapshotFeedbackError.set(false);
    this.snapshotBlockers.set([]);
    this.catalog.operateSnapshot(version, headEtag, state.config).subscribe({
      next: () => {
        this.snapshotBusy.set(false);
        this.snapshotFeedbackError.set(false);
        this.snapshotFeedback.set(this.i18n.text(
          version.availableAction === 'ROLLBACK' ? 'snapshotRolledBack' : 'snapshotActivated'));
        this.loadSnapshots();
        this.loadLifecycle();
      },
      error: error => this.failSnapshotOperation(error)
    });
  }

  displayDiffValue(value: unknown): string {
    return value === undefined ? '—' : JSON.stringify(value);
  }

  @HostListener('window:beforeunload', ['$event'])
  protectDraftOnUnload(event: BeforeUnloadEvent): void {
    if (!this.draftChanged()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  private confirmDraftDiscard(): boolean {
    return !this.authoringOpen() || !this.draftChanged()
      || window.confirm(this.i18n.text('discardChanges'));
  }

  private revealSelectedDecision(): void {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this.host.nativeElement.querySelector<HTMLElement>('.decision-row.selected')
        ?.scrollIntoView({ block: 'center', inline: 'nearest' });
    }));
  }

  private isCurrentDefinition(revision: number, definitionId: string): boolean {
    return revision === this.selectionRevision && this.selected()?.configDefinitionId === definitionId;
  }

  private isCurrentWorkspace(revision: number, workspaceId: string): boolean {
    return revision === this.selectionRevision && this.selected()?.workspaceId === workspaceId;
  }

  private clearSelection(): void {
    ++this.selectionRevision;
    ++this.timelineLoadRevision;
    ++this.lifecycleLoadRevision;
    ++this.scenariosLoadRevision;
    ++this.reviewsLoadRevision;
    ++this.workspaceCapabilitiesLoadRevision;
    ++this.operationalActionLoadRevision;
    ++this.snapshotLoadRevision;
    ++this.rolloutPolicyLoadRevision;
    ++this.rolloutLoadRevision;
    ++this.hostStatusLoadRevision;
    ++this.executionSummaryLoadRevision;
    this.selected.set(null);
    this.authoringOpen.set(false);
    this.draftCondition.set(null);
    this.editorState.set(null);
    this.timeline.set([]);
    this.lifecycle.set(null);
    this.scenarios.set([]);
    this.reviews.set([]);
    this.workspaceCapabilities.set(null);
    this.operationalAction.set(null);
    this.operationalActionLoading.set(false);
    this.operationalActionError.set(false);
    this.operationalScenarioModes.set({});
    this.editingScenarioId.set(null);
    this.operationalConfirmationOpen.set(false);
    this.sandboxRun.set(null);
    this.sandboxIdempotencyKey = null;
    this.sandboxEvaluatedAtUtc = null;
    this.pendingOperationalCommand = null;
    this.publicationReadiness.set(null);
    this.publicationResult.set(null);
    this.snapshotHead.set(null);
    this.snapshotVersions.set([]);
    this.rolloutPolicyCatalog.set(null);
    this.rolloutPolicyTimeline.set([]);
    this.rolloutCatalog.set(null);
    this.hostStatusSummary.set(null);
    this.executionSummary.set(null);
  }

  private resetDraftState(): void {
    this.draftCondition.set(this.selected()?.workspaceCondition ?? this.selected()?.condition ?? null);
    this.editorState.set(null);
  }

  private applyWorkspace(workspace: DomainRuleChangeWorkspace): void {
    const patch = (decision: DecisionSummary): DecisionSummary => ({
      ...decision,
      workspaceId: workspace.id,
      workspaceStatus: workspace.status,
      workspaceEtag: workspace.etag,
      workspaceRevision: workspace.revision,
      promotedDefinitionId: workspace.promotedDefinitionId ?? decision.promotedDefinitionId ?? null,
      workspaceCondition: workspace.condition ?? null,
      workspaceParameters: workspace.parameters
    });
    this.allDecisions.update(items => items.map(item => item.key === workspace.ruleKey ? patch(item) : item));
    const current = this.selected();
    if (current?.key === workspace.ruleKey) this.selected.set(patch(current));
    this.draftCondition.set(workspace.condition ?? null);
    this.sandboxRun.set(null);
    this.sandboxIdempotencyKey = null;
    this.sandboxEvaluatedAtUtc = null;
    this.publicationReadiness.set(null);
    this.publicationResult.set(null);
    this.loadScenarios();
    this.loadReviews();
    this.loadWorkspaceCapabilities();
  }

  private clearAuthoringMessage(): void {
    this.authoringError.set(false);
    this.authoringFeedback.set(null);
  }

  private failAuthoring(error: unknown): void {
    this.authoringBusy.set(false);
    this.authoringError.set(true);
    const key = error instanceof HttpErrorResponse && error.status === 403
      ? 'governedCommandForbidden'
      : error instanceof HttpErrorResponse && (error.status === 409 || error.status === 412)
        ? 'governedCommandConflict'
        : 'governedCommandFailed';
    this.authoringFeedback.set(this.i18n.text(key));
  }

  private failSnapshotOperation(error: unknown): void {
    this.snapshotBusy.set(false);
    this.snapshotFeedbackError.set(true);
    const problem = error instanceof HttpErrorResponse
      && isDomainRuleSnapshotProblemResponse(error.error)
      ? error.error
      : null;
    this.snapshotBlockers.set(problem?.code === 'TEST_EVIDENCE_BLOCKED' ? problem.blockers : []);
    const key = error instanceof HttpErrorResponse && error.status === 403
      ? 'governedCommandForbidden'
      : problem?.code === 'TEST_EVIDENCE_BLOCKED'
        ? 'snapshotEvidenceBlocked'
      : error instanceof HttpErrorResponse && (error.status === 409 || error.status === 412)
        ? 'governedCommandConflict'
        : 'governedCommandFailed';
    this.snapshotFeedback.set(this.i18n.text(key));
    if (error instanceof HttpErrorResponse && (error.status === 409 || error.status === 412)) {
      this.loadSnapshots();
    }
  }

  private failRolloutPolicyOperation(error: unknown): void {
    this.rolloutPolicyBusy.set(false);
    this.rolloutPolicyFeedbackError.set(true);
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
