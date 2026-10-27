import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  DomainRuleChangeWorkspace,
  DomainRuleDecision,
  DomainRuleTestScenario,
  ResourceActionCatalogItem
} from '@praxisui/core';
import { createClientRequestId } from '../../core/client-request-id';
import { PolicyStudioI18n } from '../../core/i18n';
import { ProjectionCatalogService } from '../../core/projection-catalog.service';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import type { DecisionFact, DecisionSummary, PolicySandboxRun } from './catalog.fixture';
import {
  type SuggestedScenarioTemplate,
  assertionListFromText,
  buildSuggestedScenarioTemplates,
  nestedFactPayload,
  optionalJsonValue,
  parseScenarioFactValue,
  valueAtFactPath
} from './catalog-presentation';
import { CatalogSelectionStore } from './catalog-selection.store';
import type { ScenarioUpdateView } from './scenario-catalog.component';
import type { ScenarioCreateView } from './scenario-create-form.component';

interface PendingOperationalCommand {
  readonly workspaceId: string;
  readonly selectionFingerprint: string;
  readonly idempotencyKey: string;
  readonly evaluatedAtUtc: string;
}

@Injectable()
export class ScenarioSandboxFacade {
  private readonly store = inject(CatalogSelectionStore);
  private readonly catalog = inject(ProjectionCatalogService);
  private readonly runtime = inject(RuntimeConfigService);
  private readonly i18n = inject(PolicyStudioI18n);

  readonly scenarioFeedback = signal<string | null>(null);
  readonly scenarioError = signal(false);
  readonly sandboxFeedback = signal<string | null>(null);
  readonly sandboxError = signal(false);

  readonly scenarios = signal<readonly DomainRuleTestScenario[]>([]);
  readonly scenarioFactDraft = signal<Readonly<Record<string, unknown>>>({});
  readonly scenarioFactsFallback = signal('{}');
  readonly scenarioFactsJson = computed(() => JSON.stringify(nestedFactPayload(this.scenarioFactDraft()), null, 2));
  readonly activeScenarios = computed(() => this.scenarios().filter(item => item.status === 'ACTIVE'));
  readonly suggestedScenarios = computed(() => buildSuggestedScenarioTemplates(this.store.selected()));

  readonly editingScenarioId = signal<string | null>(null);
  readonly editingScenarioDirty = signal(false);
  readonly editingScenarioFactDraft = signal<Readonly<Record<string, unknown>>>({});

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

  private scenariosLoadRevision = 0;
  private operationalActionLoadRevision = 0;
  private sandboxIdempotencyKey: string | null = null;
  private sandboxEvaluatedAtUtc: string | null = null;
  private pendingOperationalCommand: PendingOperationalCommand | null = null;

  resetSandboxState(): void {
    this.sandboxRun.set(null);
    this.sandboxIdempotencyKey = null;
    this.sandboxEvaluatedAtUtc = null;
  }

  resetForSelection(): void {
    this.resetSandboxState();
    this.pendingOperationalCommand = null;
    this.store.clearTaskMessage(this.scenarioFeedback, this.scenarioError);
    this.store.clearTaskMessage(this.sandboxFeedback, this.sandboxError);
    this.operationalAction.set(null);
    this.operationalActionError.set(false);
    this.operationalScenarioModes.set({});
    this.editingScenarioId.set(null);
    this.editingScenarioDirty.set(false);
    this.operationalConfirmationOpen.set(false);
  }

  clearAll(): void {
    ++this.scenariosLoadRevision;
    ++this.operationalActionLoadRevision;
    this.scenarios.set([]);
    this.operationalAction.set(null);
    this.operationalActionLoading.set(false);
    this.operationalActionError.set(false);
    this.operationalScenarioModes.set({});
    this.editingScenarioId.set(null);
    this.editingScenarioDirty.set(false);
    this.editingScenarioFactDraft.set({});
    this.operationalConfirmationOpen.set(false);
    this.resetSandboxState();
    this.pendingOperationalCommand = null;
  }

  discardScenarioEditState(): void {
    this.editingScenarioId.set(null);
    this.editingScenarioDirty.set(false);
    this.editingScenarioFactDraft.set({});
  }

  applyScenarioSuggestion(template: SuggestedScenarioTemplate): void {
    this.scenarioFactDraft.set({ ...template.factValues });
    this.scenarioFactsFallback.set(JSON.stringify(nestedFactPayload(template.factValues), null, 2));
  }

  loadScenarios(selectionRevision = this.store.selectionRevision): void {
    const loadRevision = ++this.scenariosLoadRevision;
    const state = this.runtime.state();
    const workspaceId = this.store.selected()?.workspaceId;
    this.scenarios.set([]);
    if (state.kind !== 'ready' || !workspaceId) return;
    this.catalog.scenarios(workspaceId, state.config).subscribe({
      next: scenarios => {
        if (loadRevision !== this.scenariosLoadRevision || !this.store.isCurrentWorkspace(selectionRevision, workspaceId)) return;
        this.scenarios.set(scenarios);
      },
      error: () => {
        if (loadRevision !== this.scenariosLoadRevision || !this.store.isCurrentWorkspace(selectionRevision, workspaceId)) return;
        this.store.authoringError.set(true);
      }
    });
  }

  loadOperationalTestAction(selectionRevision = this.store.selectionRevision): void {
    const loadRevision = ++this.operationalActionLoadRevision;
    const state = this.runtime.state();
    const resourceKey = this.store.selected()?.resourceKey;
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
          || selectionRevision !== this.store.selectionRevision) return;
        this.operationalAction.set(action);
        this.operationalActionLoading.set(false);
      },
      error: () => {
        if (loadRevision !== this.operationalActionLoadRevision
          || selectionRevision !== this.store.selectionRevision) return;
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
      || !this.store.selected()?.workspaceEtag
      || !this.operationalSelections().length
      || this.store.authoringBusy()) return;
    this.operationalConfirmationOpen.set(true);
  }

  cancelOperationalTest(): void {
    this.operationalConfirmationOpen.set(false);
  }

  runOperationalTest(): void {
    const state = this.runtime.state();
    const decision = this.store.selected();
    const action = this.operationalAction();
    const selections = this.operationalSelections();
    if (state.kind !== 'ready' || !decision?.workspaceId || !decision.workspaceEtag
      || !action?.availability.allowed || !selections.length
      || !this.operationalConfirmationOpen() || this.store.authoringBusy()) return;
    this.store.authoringBusy.set(true);
    this.operationalConfirmationOpen.set(false);
    this.store.clearAuthoringMessage();
    const commandSelectionRevision = this.store.selectionRevision;
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
        if (!this.store.isCurrentWorkspace(commandSelectionRevision, decision.workspaceId!)) {
          this.store.authoringBusy.set(false);
          return;
        }
        const patch = (item: DecisionSummary): DecisionSummary => item.key === decision.key
          ? { ...item, workspaceEtag: receipt.workspaceEtag, workspaceRevision: receipt.run.workspaceRevision }
          : item;
        this.store.allDecisions.update(items => items.map(patch));
        const current = this.store.selected();
        if (current?.key === decision.key) this.store.selected.set(patch(current));
        this.pendingOperationalCommand = null;
        this.store.authoringBusy.set(false);
        this.store.authoringFeedback.set(this.i18n.text('operationalTestCompleted'));
        this.store.loadLifecycle();
        this.store.loadWorkspaceCapabilities();
      },
      error: error => {
        if (!this.store.isCurrentWorkspace(commandSelectionRevision, decision.workspaceId!)) {
          this.store.authoringBusy.set(false);
          return;
        }
        this.store.failAuthoring(error);
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
    form: HTMLFormElement,
    onWorkspaceUpdated: (workspace: DomainRuleChangeWorkspace) => void
  ): void {
    const state = this.runtime.state();
    const workspaceId = this.store.selected()?.workspaceId;
    if (state.kind !== 'ready' || !workspaceId
      || !this.store.hasWorkspaceAction('MANAGE_SCENARIOS') || this.store.authoringBusy()) return;
    let facts: Record<string, unknown>;
    let expectedOutput: unknown;
    try {
      const parsed: unknown = JSON.parse(factsJson);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      facts = parsed as Record<string, unknown>;
    } catch {
      this.scenarioError.set(true);
      this.scenarioFeedback.set(this.i18n.text('invalidFacts'));
      return;
    }
    try {
      expectedOutput = optionalJsonValue(expectedOutputJson);
    } catch {
      this.scenarioError.set(true);
      this.scenarioFeedback.set(this.i18n.text('invalidExpectedOutput'));
      return;
    }
    this.store.authoringBusy.set(true);
    this.store.clearTaskMessage(this.scenarioFeedback, this.scenarioError);
    const commandRevision = this.store.selectionRevision;
    const commandRuleKey = this.store.selected()!.key;
    this.catalog.createScenario(workspaceId, {
      scenarioKey: key.trim(),
      name: name.trim(),
      facts,
      expectedDecision: expectedDecision as DomainRuleDecision,
      expectedOutput,
      expectedReasonCodes: assertionListFromText(expectedReasonCodes),
      expectedEffectIntents: assertionListFromText(expectedEffectIntents)
    }, state.config).subscribe({
      next: receipt => {
        if (!this.store.isCurrentCommand(commandRevision, commandRuleKey, workspaceId)) {
          this.store.authoringBusy.set(false);
          return;
        }
        onWorkspaceUpdated(receipt.workspace);
        this.scenarios.update(items => this.withScenario(items, receipt.scenario));
        this.sandboxIdempotencyKey = null;
        this.sandboxEvaluatedAtUtc = null;
        this.store.authoringBusy.set(false);
        this.scenarioFeedback.set(this.i18n.text('scenarioCreated'));
        this.scenarioFactDraft.set({});
        this.scenarioFactsFallback.set('{}');
        form.reset();
        this.store.loadLifecycle();
      },
      error: error => this.store.failTaskCommand(error, commandRevision, commandRuleKey, workspaceId,
        this.scenarioFeedback, this.scenarioError)
    });
  }

  createScenarioFromView(
    request: ScenarioCreateView,
    onWorkspaceUpdated: (workspace: DomainRuleChangeWorkspace) => void
  ): void {
    this.createScenario(
      request.key, request.name, request.factsJson, request.expectedDecision,
      request.expectedOutputJson, request.expectedReasonCodes,
      request.expectedEffectIntents, request.form, onWorkspaceUpdated);
  }

  setScenarioFactValue(fact: DecisionFact, rawValue: string | boolean): void {
    const value = parseScenarioFactValue(fact, rawValue);
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

  editScenario(scenarioId: string): void {
    if (!this.store.hasWorkspaceAction('MANAGE_SCENARIOS') || this.store.authoringBusy()) return;
    if (scenarioId !== this.editingScenarioId() && this.editingScenarioDirty()) {
      const current = this.scenarios().find(item => item.id === this.editingScenarioId());
      this.store.openUnsavedWorkConfirmation(
        current?.name ?? this.i18n.text('scenarioLocalChanges'),
        () => this.beginScenarioEdit(scenarioId));
      return;
    }
    this.beginScenarioEdit(scenarioId);
  }

  private beginScenarioEdit(scenarioId: string): void {
    const scenario = this.scenarios().find(item => item.id === scenarioId);
    if (!scenario) return;
    this.editingScenarioId.set(scenarioId);
    this.editingScenarioDirty.set(false);
    this.editingScenarioFactDraft.set(Object.fromEntries(
      (this.store.selected()?.facts ?? []).map(fact => [fact.path, valueAtFactPath(scenario.facts, fact.path)])
    ));
    this.store.clearAuthoringMessage();
  }

  cancelScenarioEdit(): void {
    if (this.editingScenarioDirty()) {
      const scenario = this.scenarios().find(item => item.id === this.editingScenarioId());
      this.store.openUnsavedWorkConfirmation(
        scenario?.name ?? this.i18n.text('scenarioLocalChanges'),
        () => this.discardScenarioEditState());
      return;
    }
    this.discardScenarioEditState();
  }

  markScenarioEditDirty(): void { this.editingScenarioDirty.set(true); }

  setEditingScenarioFactValue(fact: DecisionFact, rawValue: string | boolean): void {
    const value = parseScenarioFactValue(fact, rawValue);
    this.editingScenarioFactDraft.update(current => ({ ...current, [fact.path]: value }));
    this.editingScenarioDirty.set(true);
  }

  setEditingScenarioFactNull(fact: DecisionFact, useNull: boolean): void {
    this.editingScenarioFactDraft.update(current => {
      const next = { ...current };
      if (useNull) next[fact.path] = null;
      else delete next[fact.path];
      return next;
    });
    this.editingScenarioDirty.set(true);
  }

  editingScenarioFactsJson(): string {
    return JSON.stringify(nestedFactPayload(this.editingScenarioFactDraft()), null, 2);
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
    expectedEffectIntents: string,
    onWorkspaceUpdated: (workspace: DomainRuleChangeWorkspace) => void
  ): void {
    const state = this.runtime.state();
    const workspaceId = this.store.selected()?.workspaceId;
    if (state.kind !== 'ready' || !workspaceId || !scenario.etag
      || !this.store.hasWorkspaceAction('MANAGE_SCENARIOS') || this.store.authoringBusy()) return;
    const scenarioKey = key.trim();
    const scenarioName = name.trim();
    if (!scenarioKey || !scenarioName) {
      this.scenarioError.set(true);
      this.scenarioFeedback.set(this.i18n.text('scenarioIdentityRequired'));
      return;
    }
    let facts: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(factsJson);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      facts = parsed as Record<string, unknown>;
    } catch {
      this.scenarioError.set(true);
      this.scenarioFeedback.set(this.i18n.text('invalidFacts'));
      return;
    }
    let expectedOutput: unknown;
    try {
      expectedOutput = optionalJsonValue(expectedOutputJson);
    } catch {
      this.scenarioError.set(true);
      this.scenarioFeedback.set(this.i18n.text('invalidExpectedOutput'));
      return;
    }
    this.store.authoringBusy.set(true);
    this.store.clearTaskMessage(this.scenarioFeedback, this.scenarioError);
    const commandRevision = this.store.selectionRevision;
    const commandRuleKey = this.store.selected()!.key;
    this.catalog.updateScenario(workspaceId, scenario.id, {
      scenarioKey,
      name: scenarioName,
      facts,
      expectedDecision: expectedDecision as DomainRuleDecision,
      expectedOutput,
      expectedReasonCodes: assertionListFromText(expectedReasonCodes),
      expectedEffectIntents: assertionListFromText(expectedEffectIntents),
      status: status as 'ACTIVE' | 'DISABLED'
    }, scenario.etag, state.config).subscribe({
      next: receipt => {
        if (!this.store.isCurrentCommand(commandRevision, commandRuleKey, workspaceId)) {
          this.store.authoringBusy.set(false);
          return;
        }
        onWorkspaceUpdated(receipt.workspace);
        this.scenarios.update(items => this.withScenario(items, receipt.scenario));
        this.resetSandboxState();
        this.discardScenarioEditState();
        this.store.authoringBusy.set(false);
        this.scenarioFeedback.set(this.i18n.text('scenarioUpdated'));
        this.store.loadLifecycle();
      },
      error: error => this.store.failTaskCommand(error, commandRevision, commandRuleKey, workspaceId,
        this.scenarioFeedback, this.scenarioError)
    });
  }

  updateScenarioFromView(
    request: ScenarioUpdateView,
    onWorkspaceUpdated: (workspace: DomainRuleChangeWorkspace) => void
  ): void {
    this.updateScenario(
      request.scenario, request.key, request.name, request.factsJson,
      request.expectedDecision, request.status, request.expectedOutputJson,
      request.expectedReasonCodes, request.expectedEffectIntents, onWorkspaceUpdated);
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
    const current = this.store.selected();
    const workspaceId = current?.workspaceId;
    const scenarioIds = this.activeScenarios().map(item => item.id);
    if (state.kind !== 'ready' || !workspaceId
      || !scenarioIds.length || !this.store.hasWorkspaceAction('RECORD_TEST_RUN') || this.store.authoringBusy()) return;
    this.store.authoringBusy.set(true);
    this.store.clearTaskMessage(this.sandboxFeedback, this.sandboxError);
    const commandRevision = this.store.selectionRevision;
    const commandRuleKey = current!.key;
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
        if (!this.store.isCurrentCommand(commandRevision, commandRuleKey, workspaceId)) {
          this.store.authoringBusy.set(false);
          return;
        }
        this.sandboxIdempotencyKey = null;
        this.sandboxEvaluatedAtUtc = null;
        this.sandboxRun.set(run);
        this.store.authoringBusy.set(false);
        this.sandboxFeedback.set(this.i18n.text('sandboxCompleted'));
        this.store.loadLifecycle();
        this.store.loadWorkspaceCapabilities();
      },
      error: error => this.store.failTaskCommand(error, commandRevision, commandRuleKey, workspaceId,
        this.sandboxFeedback, this.sandboxError)
    });
  }
}
