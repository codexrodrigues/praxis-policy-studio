import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PolicyStudioI18n } from '../../core/i18n';
import { ProjectionCatalogService } from '../../core/projection-catalog.service';
import { DecisionSummary } from './catalog.fixture';
import { DecisionTimelineEvent } from './catalog.fixture';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import { HttpErrorResponse } from '@angular/common/http';
import type { RuleBuilderConfig, RuleBuilderState } from '@praxisui/visual-builder';
import { LocalDraftWorkspaceComponent } from '../authoring/local-draft-workspace.component';
import { canonicalDecisionExpression, composeDecisionCondition, editableDecisionCondition, formatDecisionExpression } from '../../core/decision-inspection';
import { AuthSessionService } from '../../core/auth-session.service';
import { PolicyStudioRuntimeConfig } from '../../core/runtime-config';

@Component({
  selector: 'pax-catalog-workspace',
  imports: [FormsModule, LocalDraftWorkspaceComponent],
  templateUrl: './catalog-workspace.component.html',
  styleUrl: './catalog-workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CatalogWorkspaceComponent implements OnInit {
  private readonly catalog = inject(ProjectionCatalogService);
  private readonly auth = inject(AuthSessionService);
  readonly runtime = inject(RuntimeConfigService);
  readonly query = signal('');
  readonly allDecisions = signal<readonly DecisionSummary[]>([]);
  readonly selected = signal<DecisionSummary | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly loading = signal(true);
  readonly authenticationRequired = signal(false);
  readonly permissionLimited = signal(false);
  readonly authenticating = signal(false);
  readonly authenticationFailed = signal(false);
  readonly savingDraft = signal(false);
  readonly draftSaveError = signal(false);
  readonly timeline = signal<readonly DecisionTimelineEvent[]>([]);
  readonly authoringOpen = signal(false);
  readonly draftCondition = signal<unknown | null>(null);
  readonly editorState = signal<RuleBuilderState | null>(null);
  readonly originalExpression = computed(() => formatDecisionExpression(this.selected()?.condition));
  readonly draftExpression = computed(() => formatDecisionExpression(this.draftCondition()));
  readonly editorCondition = computed(() => editableDecisionCondition(this.draftCondition()));
  readonly draftChanged = computed(() => canonicalDecisionExpression(this.selected()?.condition) !==
    canonicalDecisionExpression(this.draftCondition()));
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

  constructor(readonly i18n: PolicyStudioI18n) {}

  ngOnInit(): void {
    this.loadCatalog();
  }

  loadCatalog(): void {
    const state = this.runtime.state();
    if (state.kind !== 'ready') return;
    this.loading.set(true);
    this.loadError.set(null);
    this.authenticationRequired.set(false);
    this.permissionLimited.set(false);
    this.catalog.load('/projections/ergonx-rn013.v1.json', this.i18n.locale(), state.config).subscribe({
      next: decisions => {
        this.authenticationFailed.set(false);
        this.allDecisions.set(decisions);
        const initial = decisions.find(item => item.code === 'ERG-08382') ?? decisions[0] ?? null;
        if (initial) this.select(initial);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(error instanceof Error ? error.message : 'PROJECTION_LOAD_FAILED');
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.authenticationRequired.set(true);
        } else if (error instanceof HttpErrorResponse && error.status === 403) {
          this.resolveForbiddenResponse(state.config);
        }
      }
    });
  }

  private resolveForbiddenResponse(config: PolicyStudioRuntimeConfig): void {
    this.auth.hasSession(config).subscribe({
      next: active => active ? this.permissionLimited.set(true) : this.authenticationRequired.set(true),
      error: () => this.loadError.set('SESSION_STATUS_UNAVAILABLE')
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

  updateQuery(value: string): void { this.query.set(value); }
  select(decision: DecisionSummary): void {
    this.selected.set(decision);
    this.authoringOpen.set(false);
    this.draftCondition.set(decision.condition);
    this.editorState.set(null);
    this.draftSaveError.set(false);
    this.timeline.set([]);
    const state = this.runtime.state();
    if (state.kind === 'ready' && decision.configDefinitionId) {
      this.catalog.timeline(decision.configDefinitionId, state.config).subscribe({
        next: events => this.timeline.set(events),
        error: () => this.timeline.set([])
      });
    }
  }

  openAuthoring(): void {
    const decision = this.selected();
    if (!decision?.editable || !decision.condition) return;
    this.draftCondition.set(decision.condition);
    this.editorState.set(null);
    this.draftSaveError.set(false);
    this.authoringOpen.set(true);
  }

  closeAuthoring(): void { this.authoringOpen.set(false); }
  updateDraft(condition: unknown): void {
    this.draftCondition.set(composeDecisionCondition(this.selected()?.condition, condition));
  }
  updateEditorState(state: RuleBuilderState): void { this.editorState.set(state); }
  resetDraft(): void {
    this.draftCondition.set(this.selected()?.condition ?? null);
    this.editorState.set(null);
    this.draftSaveError.set(false);
  }

  saveDraftVersion(): void {
    const current = this.selected();
    const state = this.runtime.state();
    if (state.kind !== 'ready' || !current?.configDefinition || !this.draftChanged() ||
        !current.availableActions?.includes('CREATE_NEW_VERSION') || this.savingDraft()) return;
    this.savingDraft.set(true);
    this.draftSaveError.set(false);
    this.catalog.createDraftVersion(current.configDefinition, this.draftCondition(), state.config).subscribe({
      next: () => {
        this.savingDraft.set(false);
        this.authoringOpen.set(false);
        this.loadCatalog();
      },
      error: () => {
        this.savingDraft.set(false);
        this.draftSaveError.set(true);
      }
    });
  }
}
