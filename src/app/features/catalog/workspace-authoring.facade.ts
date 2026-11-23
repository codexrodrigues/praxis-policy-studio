import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  DomainRuleChangeWorkspace,
  DomainRuleDefinitionRequest,
  DomainRuleWorkspaceReview
} from '@praxisui/core';
import type { RuleBuilderConfig, RuleBuilderState } from '@praxisui/visual-builder';
import {
  canonicalDecisionExpression,
  composeDecisionCondition,
  editableDecisionCondition,
  formatDecisionExpression
} from '../../core/decision-inspection';
import { PolicyStudioI18n } from '../../core/i18n';
import { ProjectionCatalogService } from '../../core/projection-catalog.service';
import {
  DOMAIN_RULE_DOCUMENTATION_KEY,
  extractRuleDocumentation,
  normalizeAndCompactDocumentation,
  type RuleDocumentationDescriptor
} from '../../core/rule-documentation';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import { semanticDecisionDiff } from '../../core/semantic-decision-diff';
import type {
  DecisionPublicationResult,
  DecisionSummary,
  PublicationReadiness
} from './catalog.fixture';
import {
  buildSuggestedDraftDiffProposals,
  effectiveDecisionParameters,
  effectiveWorkspaceCondition,
  hasAllowOperationalEffect,
  hasEditableDecisionParameters,
  inspectDecisionExpressionOntology,
  rewriteDecisionExpressionOntology,
  type DecisionOntologyInspection,
  type SuggestedDraftDiffProposal
} from './catalog-presentation';
import { CatalogSelectionStore } from './catalog-selection.store';
import { ScenarioSandboxFacade } from './scenario-sandbox.facade';
import { SnapshotExecutionFacade } from './snapshot-execution.facade';

@Injectable()
export class WorkspaceAuthoringFacade {
  private readonly store = inject(CatalogSelectionStore);
  private readonly testing = inject(ScenarioSandboxFacade);
  private readonly snapshots = inject(SnapshotExecutionFacade);
  private readonly catalog = inject(ProjectionCatalogService);
  private readonly runtime = inject(RuntimeConfigService);
  private readonly i18n = inject(PolicyStudioI18n);

  readonly authoringOpen = signal(false);
  readonly reviews = signal<readonly DomainRuleWorkspaceReview[]>([]);
  readonly reviewRationaleValue = signal('');
  readonly publicationReadiness = signal<PublicationReadiness | null>(null);
  readonly publicationResult = signal<DecisionPublicationResult | null>(null);

  readonly draftCondition = signal<unknown | null>(null);
  readonly draftParameters = signal<Readonly<Record<string, unknown>>>({});
  readonly parameterValidationErrors = signal<readonly string[]>([]);
  readonly draftDocumentation = signal<RuleDocumentationDescriptor | null>(null);
  readonly documentationValidationErrors = signal<readonly string[]>([]);
  readonly editorState = signal<RuleBuilderState | null>(null);

  readonly ontologyInspection = computed<DecisionOntologyInspection>(() =>
    inspectDecisionExpressionOntology(this.store.selected(), this.draftCondition())
  );
  readonly ontologicalWarning = computed<string | null>(() => {
    const inspection = this.ontologyInspection();
    if (inspection.valid) return null;
    const isPtBr = this.i18n.locale() === 'pt-BR';
    return isPtBr
      ? `Referência fora do contrato ontológico (${inspection.invalidVars.join(', ')}). Raízes permitidas: ${inspection.allowedRoots.join(', ')}.`
      : `Reference outside ontological contract (${inspection.invalidVars.join(', ')}). Allowed roots: ${inspection.allowedRoots.join(', ')}.`;
  });
  readonly totalAuthoringValidationErrors = computed(() =>
    (this.editorState()?.validationErrors?.length ?? 0)
    + this.parameterValidationErrors().length
    + this.documentationValidationErrors().length
    + this.ontologyInspection().invalidVars.length
  );
  readonly originalExpression = computed(() => formatDecisionExpression(this.store.selected()?.condition));
  readonly draftExpression = computed(() => formatDecisionExpression(this.draftCondition()));
  readonly editorCondition = computed(() => editableDecisionCondition(this.draftCondition()));
  readonly draftParametersChanged = computed(() => {
    const decision = this.store.selected();
    if (!this.hasEditableParameters(decision)) return false;
    return semanticDecisionDiff(
      this.effectiveParameters(decision),
      this.draftParameters(),
      '$.parameters'
    ).length > 0;
  });
  readonly draftDocumentationChanged = computed(() => {
    const decision = this.store.selected();
    if (!decision) return false;
    const baseline = normalizeAndCompactDocumentation(this.effectiveDocumentation(decision)) ?? {};
    const candidate = normalizeAndCompactDocumentation(this.draftDocumentation()) ?? {};
    return semanticDecisionDiff(baseline, candidate, '$.documentation').length > 0;
  });
  readonly draftChanged = computed(() => canonicalDecisionExpression(
    effectiveWorkspaceCondition(this.store.selected())) !==
    canonicalDecisionExpression(this.draftCondition())
    || this.draftParametersChanged()
    || this.draftDocumentationChanged());
  readonly semanticDiff = computed(() => {
    const decision = this.store.selected();
    const conditionDiff = semanticDecisionDiff(
      decision?.condition,
      this.authoringOpen()
        ? this.draftCondition()
        : effectiveWorkspaceCondition(decision)
    );
    const paramDiff = this.hasEditableParameters(decision)
      ? semanticDecisionDiff(
          decision?.parameters ?? {},
          this.authoringOpen() ? this.draftParameters() : this.effectiveParameters(decision),
          '$.parameters'
        )
      : [];
    const baseDoc = normalizeAndCompactDocumentation(
      decision?.definitionDocumentation ?? (!decision?.workspaceId ? decision?.documentation : null) ?? null
    ) ?? {};
    const candidateDoc = normalizeAndCompactDocumentation(
      this.authoringOpen() ? this.draftDocumentation() : this.effectiveDocumentation(decision)
    ) ?? {};
    const docDiff = semanticDecisionDiff(baseDoc, candidateDoc, '$.documentation');
    return [...conditionDiff, ...paramDiff, ...docDiff];
  });
  readonly editorConfig = computed<RuleBuilderConfig | null>(() => {
    const decision = this.store.selected();
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
  readonly suggestedDiffProposals = computed<readonly SuggestedDraftDiffProposal[]>(() => {
    const decision = this.store.selected();
    const condition = this.authoringOpen()
      ? this.draftCondition()
      : effectiveWorkspaceCondition(decision);
    const parameters = this.authoringOpen()
      ? this.draftParameters()
      : this.effectiveParameters(decision);
    return buildSuggestedDraftDiffProposals(decision, condition, parameters);
  });

  private reviewsLoadRevision = 0;

  hasEditableParameters(decision: DecisionSummary | null | undefined): boolean {
    return hasEditableDecisionParameters(decision);
  }

  canOpenAuthoring(decision: DecisionSummary | null | undefined): boolean {
    return !!decision?.authoringSupported && this.store.hasWorkspaceAction('VIEW');
  }

  effectiveParameters(decision: DecisionSummary | null | undefined): Readonly<Record<string, unknown>> {
    return effectiveDecisionParameters(decision);
  }

  effectiveDocumentation(decision: DecisionSummary | null | undefined): RuleDocumentationDescriptor | null {
    if (!decision) return null;
    if (decision.workspaceId && decision.workspaceDocumentation !== undefined) {
      return decision.workspaceDocumentation;
    }
    return decision.definitionDocumentation ?? decision.documentation ?? null;
  }

  openAuthoring(): void {
    if (this.authoringOpen()) return;
    const decision = this.store.selected();
    if (!this.canOpenAuthoring(decision)) return;
    this.draftCondition.set(effectiveWorkspaceCondition(decision));
    this.draftParameters.set(this.effectiveParameters(decision));
    this.parameterValidationErrors.set([]);
    this.draftDocumentation.set(this.effectiveDocumentation(decision));
    this.documentationValidationErrors.set([]);
    this.editorState.set(null);
    this.authoringOpen.set(true);
  }

  closeAuthoring(): void {
    if (this.draftChanged()) {
      this.store.openUnsavedWorkConfirmation(
        this.store.selected()?.name ?? this.i18n.text('localDraft'),
        () => this.completeCloseAuthoring());
      return;
    }
    this.completeCloseAuthoring();
  }

  completeCloseAuthoring(): void {
    this.resetDraftState();
    this.authoringOpen.set(false);
  }

  updateDraft(condition: unknown): void {
    const decision = this.store.selected();
    const source = effectiveWorkspaceCondition(decision);
    const composed = composeDecisionCondition(source, condition);
    this.draftCondition.set(composed);
    this.syncParametersFromConditionPointers(decision, composed);
  }

  updateDraftParameters(parameters: Readonly<Record<string, unknown>>): void {
    this.draftParameters.set(parameters);
    if (hasAllowOperationalEffect(parameters)) {
      this.draftCondition.set(null);
      return;
    }
    this.syncConditionFromParameterPointers(this.store.selected(), parameters);
  }

  private syncParametersFromConditionPointers(decision: DecisionSummary | null | undefined, condition: unknown): void {
    const params = decision?.parameterCatalog?.parameters;
    if (!params?.length || !condition) return;
    const currentParams = this.draftParameters();
    const rawValues = currentParams['parameterValues'];
    const currentValues = rawValues && typeof rawValues === 'object' && !Array.isArray(rawValues)
      ? { ...(rawValues as Record<string, unknown>) }
      : {};
    let changed = false;
    for (const descriptor of params) {
      const pointer = descriptor.expressionPointers?.[0];
      if (!pointer) continue;
      const pointerValue = readJsonPointer(condition, pointer);
      if (pointerValue === undefined || pointerValue === null || typeof pointerValue === 'object') continue;
      if ((descriptor.type === 'NUMBER' || descriptor.type === 'INTEGER') && typeof pointerValue !== 'number') continue;
      if (descriptor.type === 'BOOLEAN' && typeof pointerValue !== 'boolean') continue;
      if (!Object.is(currentValues[descriptor.name], pointerValue)) {
        currentValues[descriptor.name] = pointerValue;
        changed = true;
      }
    }
    if (changed) {
      this.draftParameters.set({
        ...currentParams,
        parameterValues: currentValues
      });
    }
  }

  private syncConditionFromParameterPointers(
    decision: DecisionSummary | null | undefined,
    parameters: Readonly<Record<string, unknown>>
  ): void {
    const params = decision?.parameterCatalog?.parameters;
    const rawValues = parameters['parameterValues'];
    if (!params?.length || !rawValues || typeof rawValues !== 'object' || Array.isArray(rawValues)) return;
    const values = rawValues as Readonly<Record<string, unknown>>;
    let updatedCondition = this.draftCondition() ?? effectiveWorkspaceCondition(decision);
    if (!updatedCondition) return;
    let changed = false;
    for (const descriptor of params) {
      if (!descriptor.expressionPointers?.length || !(descriptor.name in values)) continue;
      const paramValue = values[descriptor.name];
      if (paramValue === undefined || typeof paramValue === 'object' && paramValue !== null) continue;
      for (const pointer of descriptor.expressionPointers) {
        if (readJsonPointer(updatedCondition, pointer) !== undefined
          && !Object.is(readJsonPointer(updatedCondition, pointer), paramValue)) {
          updatedCondition = writeJsonPointer(updatedCondition, pointer, paramValue);
          changed = true;
        }
      }
    }
    if (changed) {
      this.draftCondition.set(updatedCondition);
    }
  }

  updateDraftDocumentation(documentation: RuleDocumentationDescriptor | null): void {
    this.draftDocumentation.set(documentation);
  }

  applyDiffProposal(proposal: SuggestedDraftDiffProposal): void {
    if (proposal.condition !== null && proposal.condition !== undefined) {
      this.draftCondition.set(proposal.condition);
    }
    if (proposal.parameters !== null && proposal.parameters !== undefined) {
      this.updateDraftParameters(proposal.parameters);
    }
  }

  autoFixDraftOntology(): void {
    const current = this.draftCondition();
    if (!current) return;
    const rewritten = rewriteDecisionExpressionOntology(this.store.selected(), current);
    this.draftCondition.set(rewritten);
    this.editorState.set(null);
  }

  updateEditorState(state: RuleBuilderState): void {
    this.editorState.set(state);
  }

  resetDraft(): void {
    if (this.draftChanged()) {
      this.store.openUnsavedWorkConfirmation(
        this.store.selected()?.name ?? this.i18n.text('localDraft'),
        () => this.resetDraftState());
      return;
    }
    this.resetDraftState();
  }

  resetDraftState(): void {
    const decision = this.store.selected();
    this.draftCondition.set(effectiveWorkspaceCondition(decision));
    this.draftParameters.set(this.effectiveParameters(decision));
    this.parameterValidationErrors.set([]);
    this.draftDocumentation.set(this.effectiveDocumentation(decision));
    this.documentationValidationErrors.set([]);
    this.editorState.set(null);
  }

  resetForSelection(decision: DecisionSummary): void {
    this.authoringOpen.set(false);
    this.draftCondition.set(effectiveWorkspaceCondition(decision));
    this.draftParameters.set(this.effectiveParameters(decision));
    this.parameterValidationErrors.set([]);
    this.draftDocumentation.set(this.effectiveDocumentation(decision));
    this.documentationValidationErrors.set([]);
    this.editorState.set(null);
    this.publicationReadiness.set(null);
    this.publicationResult.set(null);
    this.store.clearAuthoringMessage();
    this.reviewRationaleValue.set('');
  }

  clearAll(): void {
    ++this.reviewsLoadRevision;
    this.authoringOpen.set(false);
    this.draftCondition.set(null);
    this.draftParameters.set({});
    this.parameterValidationErrors.set([]);
    this.draftDocumentation.set(null);
    this.documentationValidationErrors.set([]);
    this.editorState.set(null);
    this.reviews.set([]);
    this.publicationReadiness.set(null);
    this.publicationResult.set(null);
  }

  createGovernedDecision(
    request: DomainRuleDefinitionRequest,
    onSelectDecision: (decision: DecisionSummary) => void
  ): void {
    const state = this.runtime.state();
    if (state.kind !== 'ready' || state.config.mode !== 'remote' || this.store.authoringBusy()) return;
    this.store.authoringBusy.set(true);
    this.store.clearAuthoringMessage();
    const commandCatalogRevision = this.store.catalogLoadRevision;
    this.catalog.createDefinition(request, state.config).subscribe({
      next: created => {
        if (commandCatalogRevision !== this.store.catalogLoadRevision) {
          this.store.authoringBusy.set(false);
          return;
        }
        this.store.authoringBusy.set(false);
        this.store.authoringFeedback.set(this.i18n.text('decisionCreated'));
        this.catalog.load(this.i18n.locale(), {
          ...state.config,
          initialDecisionKey: created.ruleKey
        }).subscribe({
          next: decisions => {
            if (commandCatalogRevision !== this.store.catalogLoadRevision) return;
            this.store.allDecisions.set(decisions);
            const match = decisions.find(item => item.key === created.ruleKey);
            if (match) onSelectDecision(match);
          }
        });
      },
      error: error => this.store.failAuthoring(error)
    });
  }

  reportDecisionCreateValidation(message: string): void {
    this.store.authoringError.set(true);
    this.store.authoringFeedback.set(message);
  }

  createWorkspace(): void {
    const state = this.runtime.state();
    const decision = this.store.selected();
    const baseDefinitionId = decision?.promotedDefinitionId ?? decision?.configDefinitionId;
    if (state.kind !== 'ready' || !decision || !baseDefinitionId
      || !this.store.hasDefinitionAction('CREATE_NEW_VERSION') || this.store.authoringBusy()) return;
    this.store.authoringBusy.set(true);
    this.store.clearAuthoringMessage();
    const commandRevision = this.store.selectionRevision;
    const commandRuleKey = decision.key;
    this.catalog.createWorkspace(baseDefinitionId, decision.name, state.config).subscribe({
      next: workspace => {
        if (!this.store.isCurrentCommand(commandRevision, commandRuleKey)) {
          this.store.authoringBusy.set(false);
          return;
        }
        this.applyWorkspace(workspace);
        this.store.authoringBusy.set(false);
        this.store.authoringFeedback.set(this.i18n.text('workspaceCreated'));
        this.store.loadLifecycle();
      },
      error: error => this.store.failAuthoringCommand(error, commandRevision, commandRuleKey)
    });
  }

  saveGovernedDraft(): void {
    const state = this.runtime.state();
    const decision = this.store.selected();
    if (state.kind !== 'ready' || !decision?.workspaceId || !decision.workspaceEtag
      || !this.store.hasWorkspaceAction('UPDATE_DRAFT') || this.store.authoringBusy()
      || this.totalAuthoringValidationErrors() > 0) return;
    this.store.authoringBusy.set(true);
    this.store.clearAuthoringMessage();
    const commandRevision = this.store.selectionRevision;
    const commandRuleKey = decision.key;
    const commandWorkspaceId = decision.workspaceId;
    const nextParameters = this.hasEditableParameters(decision)
      ? this.draftParameters()
      : { ...(decision.workspaceParameters ?? {}) };
    const conditionChanged = canonicalDecisionExpression(
      effectiveWorkspaceCondition(decision)
    ) !== canonicalDecisionExpression(this.draftCondition());
    const hasTemplate = (decision.parameterCatalog?.parameters.length ?? 0) > 0;
    const conditionPayload = hasTemplate && !conditionChanged ? null : this.draftCondition();
    const workspaceRef = {
      id: decision.workspaceId,
      etag: decision.workspaceEtag,
      parameters: nextParameters as Record<string, unknown>
    };
    const documentationChanged = this.draftDocumentationChanged();
    const documentationPayload = documentationChanged
      ? (normalizeAndCompactDocumentation(this.draftDocumentation()) ?? {})
      : undefined;
    const save$ = documentationChanged
      ? this.catalog.saveWorkspaceDraft(workspaceRef, conditionPayload, state.config, nextParameters, documentationPayload)
      : this.catalog.saveWorkspaceDraft(workspaceRef, conditionPayload, state.config, nextParameters);
    save$.subscribe({
      next: workspace => {
        if (!this.store.isCurrentCommand(commandRevision, commandRuleKey, commandWorkspaceId)) {
          this.store.authoringBusy.set(false);
          return;
        }
        this.applyWorkspace(workspace);
        this.store.authoringBusy.set(false);
        this.store.authoringFeedback.set(this.i18n.text('draftSaved'));
        this.store.loadLifecycle();
      },
      error: error => this.store.failAuthoringCommand(error, commandRevision, commandRuleKey, commandWorkspaceId)
    });
  }

  loadReviews(selectionRevision = this.store.selectionRevision): void {
    const loadRevision = ++this.reviewsLoadRevision;
    const state = this.runtime.state();
    const workspaceId = this.store.selected()?.workspaceId;
    this.reviews.set([]);
    this.reviewRationaleValue.set('');
    if (state.kind !== 'ready' || !workspaceId) return;
    this.catalog.reviews(workspaceId, state.config).subscribe({
      next: reviews => {
        if (loadRevision !== this.reviewsLoadRevision || !this.store.isCurrentWorkspace(selectionRevision, workspaceId)) return;
        this.reviews.set(reviews);
      },
      error: () => {
        if (loadRevision !== this.reviewsLoadRevision || !this.store.isCurrentWorkspace(selectionRevision, workspaceId)) return;
        this.store.authoringError.set(true);
      }
    });
  }

  submitGovernedWorkspace(): void {
    const state = this.runtime.state();
    const decision = this.store.selected();
    if (state.kind !== 'ready' || !decision?.workspaceId || !decision.workspaceEtag
      || !this.store.hasWorkspaceAction('SUBMIT') || this.store.authoringBusy()) return;
    this.store.authoringBusy.set(true);
    this.store.clearAuthoringMessage();
    const commandRevision = this.store.selectionRevision;
    const commandRuleKey = decision.key;
    this.catalog.submitWorkspace(decision.workspaceId, decision.workspaceEtag, state.config).subscribe({
      next: workspace => {
        if (!this.store.isCurrentCommand(commandRevision, commandRuleKey, decision.workspaceId!)) {
          this.store.authoringBusy.set(false);
          return;
        }
        this.applyWorkspace(workspace);
        this.store.authoringBusy.set(false);
        this.store.authoringFeedback.set(this.i18n.text('workspaceSubmitted'));
        this.store.loadLifecycle();
      },
      error: error => this.store.failAuthoringCommand(error, commandRevision, commandRuleKey, decision.workspaceId!)
    });
  }

  reviewGovernedWorkspace(
    decision: 'APPROVE' | 'REJECT',
    rationale: string,
    form: HTMLFormElement
  ): void {
    const state = this.runtime.state();
    const current = this.store.selected();
    const normalizedRationale = rationale.trim();
    if (state.kind !== 'ready' || !current?.workspaceId || !current.workspaceEtag
      || !normalizedRationale || !this.store.hasWorkspaceAction('REVIEW') || this.store.authoringBusy()) return;
    this.store.authoringBusy.set(true);
    this.store.clearAuthoringMessage();
    const commandRevision = this.store.selectionRevision;
    const commandRuleKey = current.key;
    this.catalog.reviewWorkspace(current.workspaceId, current.workspaceEtag, decision, normalizedRationale, state.config).subscribe({
      next: workspace => {
        if (!this.store.isCurrentCommand(commandRevision, commandRuleKey, current.workspaceId!)) {
          this.store.authoringBusy.set(false);
          return;
        }
        this.applyWorkspace(workspace);
        this.store.authoringBusy.set(false);
        this.store.authoringFeedback.set(this.i18n.text(decision === 'APPROVE' ? 'workspaceApproved' : 'workspaceRejected'));
        this.reviewRationaleValue.set('');
        form.reset();
        this.loadReviews();
        this.store.loadLifecycle();
      },
      error: error => this.store.failAuthoringCommand(error, commandRevision, commandRuleKey, current.workspaceId!)
    });
  }

  promoteGovernedWorkspace(): void {
    const state = this.runtime.state();
    const current = this.store.selected();
    if (state.kind !== 'ready' || !current?.workspaceId || !current.workspaceEtag
      || !this.store.hasWorkspaceAction('PROMOTE') || this.store.authoringBusy()) return;
    this.store.authoringBusy.set(true);
    this.store.clearAuthoringMessage();
    const commandRevision = this.store.selectionRevision;
    const commandRuleKey = current.key;
    this.catalog.promoteWorkspace(current.workspaceId, current.workspaceEtag, state.config).subscribe({
      next: workspace => {
        if (!this.store.isCurrentCommand(commandRevision, commandRuleKey, current.workspaceId!)) {
          this.store.authoringBusy.set(false);
          return;
        }
        this.applyWorkspace(workspace);
        this.store.authoringBusy.set(false);
        this.store.authoringFeedback.set(this.i18n.text('workspacePromoted'));
        this.refreshDefinitionActions(commandRevision, commandRuleKey);
        this.inspectPublicationReadiness(false);
        this.loadReviews();
        this.store.loadLifecycle();
      },
      error: error => this.store.failAuthoringCommand(error, commandRevision, commandRuleKey, current.workspaceId!)
    });
  }

  private refreshDefinitionActions(commandRevision: number, ruleKey: string): void {
    const state = this.runtime.state();
    const current = this.store.selected();
    if (state.kind !== 'ready' || !current || typeof this.catalog.definitionActions !== 'function') return;
    this.catalog.definitionActions(
      current.configDefinitionId,
      current.key,
      current.configVersion,
      current.promotedDefinitionId,
      state.config
    ).subscribe({
      next: actions => {
        if (!this.store.isCurrentCommand(commandRevision, ruleKey)) return;
        const patch = (decision: DecisionSummary): DecisionSummary => ({
          ...decision,
          availableDefinitionActions: actions
        });
        this.store.allDecisions.update(items => items.map(item => item.key === ruleKey ? patch(item) : item));
        const selected = this.store.selected();
        if (selected?.key === ruleKey) this.store.selected.set(patch(selected));
      }
    });
  }

  inspectPublicationReadiness(clearMessage = true): void {
    const state = this.runtime.state();
    const current = this.store.selected();
    const definitionId = current?.promotedDefinitionId;
    if (state.kind !== 'ready' || !definitionId || this.store.authoringBusy()) return;
    this.store.authoringBusy.set(true);
    if (clearMessage) this.store.clearAuthoringMessage();
    const commandRevision = this.store.selectionRevision;
    const commandRuleKey = current!.key;
    this.catalog.inspectPublicationReadiness(definitionId, state.config).subscribe({
      next: readiness => {
        if (!this.store.isCurrentCommand(commandRevision, commandRuleKey)) {
          this.store.authoringBusy.set(false);
          return;
        }
        this.publicationReadiness.set(readiness);
        this.publicationResult.set(null);
        this.store.authoringBusy.set(false);
      },
      error: error => this.store.failAuthoringCommand(error, commandRevision, commandRuleKey)
    });
  }

  publishGovernedDefinition(): void {
    const state = this.runtime.state();
    const current = this.store.selected();
    const definitionId = current?.promotedDefinitionId;
    if (state.kind !== 'ready' || !definitionId || this.store.authoringBusy()
      || !this.store.hasDefinitionAction('PUBLISH')) return;
    const currentReadiness = this.publicationReadiness();
    if (currentReadiness && currentReadiness.readiness !== 'ready_to_publish') return;
    this.store.authoringBusy.set(true);
    this.store.clearAuthoringMessage();
    const commandRevision = this.store.selectionRevision;
    const commandRuleKey = current!.key;
    const executePublish = () => {
      this.catalog.publishDefinition(definitionId, state.config).subscribe({
        next: publication => {
          if (!this.store.isCurrentCommand(commandRevision, commandRuleKey)) {
            this.store.authoringBusy.set(false);
            return;
          }
          this.publicationResult.set(publication);
          this.store.authoringBusy.set(false);
          this.store.authoringFeedback.set(this.i18n.text(
            publication.status === 'published' ? 'definitionPublished' : 'publicationBlocked'));
          if (publication.status === 'published') {
            const patchPublished = (item: DecisionSummary): DecisionSummary => ({
              ...item,
              configStatus: 'active'
            });
            this.store.allDecisions.update(items =>
              items.map(item => item.key === commandRuleKey ? patchPublished(item) : item));
            const selected = this.store.selected();
            if (selected?.key === commandRuleKey) {
              this.store.selected.set(patchPublished(selected));
            }
            if (state.config.mode === 'remote') {
              const loadRevision = ++this.store.catalogLoadRevision;
              this.catalog.load(this.i18n.locale(), {
                ...state.config,
                initialDecisionKey: commandRuleKey
              }).subscribe({
                next: decisions => {
                  if (loadRevision !== this.store.catalogLoadRevision || decisions.length === 0) return;
                  this.store.allDecisions.set(decisions);
                  const refreshed = decisions.find(item => item.key === commandRuleKey);
                  if (refreshed && this.store.selected()?.key === commandRuleKey) {
                    this.store.selected.set(refreshed);
                  }
                },
                error: () => {
                  // Non-blocking catalog refresh after publication
                }
              });
            }
          }
          this.store.loadLifecycle();
          this.store.loadTimeline();
          this.snapshots.loadSnapshots();
        },
        error: error => this.store.failAuthoringCommand(error, commandRevision, commandRuleKey)
      });
    };
    if (!currentReadiness) {
      this.catalog.inspectPublicationReadiness(definitionId, state.config).subscribe({
        next: readiness => {
          if (!this.store.isCurrentCommand(commandRevision, commandRuleKey)) {
            this.store.authoringBusy.set(false);
            return;
          }
          this.publicationReadiness.set(readiness);
          if (readiness.readiness !== 'ready_to_publish') {
            this.store.authoringBusy.set(false);
            this.store.authoringError.set(true);
            this.store.authoringFeedback.set(this.i18n.text('publicationBlocked'));
            return;
          }
          executePublish();
        },
        error: error => this.store.failAuthoringCommand(error, commandRevision, commandRuleKey)
      });
      return;
    }
    executePublish();
  }

  applyWorkspace(workspace: DomainRuleChangeWorkspace): void {
    const hasWorkspaceDoc = Object.prototype.hasOwnProperty.call(workspace, DOMAIN_RULE_DOCUMENTATION_KEY)
      && (workspace as { documentation?: unknown }).documentation !== undefined;
    const parsedWorkspaceDoc = hasWorkspaceDoc
      ? extractRuleDocumentation((workspace as { documentation?: unknown }).documentation)
      : undefined;
    const patch = (decision: DecisionSummary): DecisionSummary => {
      const nextWorkspaceDoc = parsedWorkspaceDoc !== undefined
        ? parsedWorkspaceDoc
        : decision.workspaceDocumentation;
      const nextDefinitionDoc = workspace.promotedDefinitionId
        ? (parsedWorkspaceDoc !== undefined ? parsedWorkspaceDoc : (decision.workspaceDocumentation ?? decision.definitionDocumentation))
        : decision.definitionDocumentation;
      return {
        ...decision,
        configDefinitionId: workspace.baseDefinitionId ?? decision.configDefinitionId,
        configVersion: workspace.baseDefinitionVersion ?? decision.configVersion,
        workspaceId: workspace.id,
        workspaceStatus: workspace.status,
        workspaceEtag: workspace.etag,
        workspaceRevision: workspace.revision,
        promotedDefinitionId: workspace.status === 'PROMOTED'
          ? (workspace.promotedDefinitionId ?? decision.promotedDefinitionId ?? null)
          : (workspace.promotedDefinitionId ?? null),
        configStatus: workspace.promotedDefinitionId ? 'approved' : decision.configStatus,
        workspaceCondition: workspace.condition ?? null,
        workspaceParameters: workspace.parameters,
        workspaceDocumentation: nextWorkspaceDoc,
        definitionDocumentation: nextDefinitionDoc,
        documentation: (nextWorkspaceDoc !== undefined ? nextWorkspaceDoc : null) ?? nextDefinitionDoc ?? decision.documentation ?? null,
        parameterCatalog: this.catalog.overlayParameterCatalog(decision.parameterCatalog, workspace.parameters)
      };
    };
    this.store.allDecisions.update(items => items.map(item => item.key === workspace.ruleKey ? patch(item) : item));
    const current = this.store.selected();
    const updated = current?.key === workspace.ruleKey ? patch(current) : current;
    if (updated && current?.key === workspace.ruleKey) this.store.selected.set(updated);
    this.draftCondition.set(effectiveWorkspaceCondition(updated));
    this.draftParameters.set(this.effectiveParameters(updated));
    this.draftDocumentation.set(this.effectiveDocumentation(updated));
    this.documentationValidationErrors.set([]);
    this.testing.resetSandboxState();
    this.publicationReadiness.set(null);
    this.publicationResult.set(null);
    this.testing.loadScenarios();
    this.loadReviews();
    this.store.loadWorkspaceCapabilities();
  }
}

function decodeJsonPointer(pointer: string): readonly string[] | null {
  if (!pointer.startsWith('/')) return null;
  return pointer.slice(1).split('/').map(segment => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function readJsonPointer(root: unknown, pointer: string): unknown {
  const segments = decodeJsonPointer(pointer);
  if (!segments) return undefined;
  let current: unknown = root;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return undefined;
      current = current[index];
    } else if (current && typeof current === 'object') {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

function writeJsonPointer(root: unknown, pointer: string, nextValue: unknown): unknown {
  const segments = decodeJsonPointer(pointer);
  if (!segments || segments.length === 0) return root;
  const setAt = (node: unknown, depth: number): unknown => {
    const segment = segments[depth];
    const isLeaf = depth === segments.length - 1;
    if (Array.isArray(node)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= node.length) return node;
      const copy = [...node];
      copy[index] = isLeaf ? nextValue : setAt(copy[index], depth + 1);
      return copy;
    }
    if (node && typeof node === 'object') {
      const record = node as Record<string, unknown>;
      if (!(segment in record)) return node;
      return {
        ...record,
        [segment]: isLeaf ? nextValue : setAt(record[segment], depth + 1)
      };
    }
    return node;
  };
  return setAt(root, 0);
}
