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

@Component({
  selector: 'pax-catalog-workspace',
  imports: [FormsModule, LocalDraftWorkspaceComponent],
  templateUrl: './catalog-workspace.component.html',
  styleUrl: './catalog-workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CatalogWorkspaceComponent implements OnInit {
  private readonly catalog = inject(ProjectionCatalogService);
  readonly runtime = inject(RuntimeConfigService);
  readonly query = signal('');
  readonly allDecisions = signal<readonly DecisionSummary[]>([]);
  readonly selected = signal<DecisionSummary | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly loading = signal(true);
  readonly permissionLimited = signal(false);
  readonly timeline = signal<readonly DecisionTimelineEvent[]>([]);
  readonly authoringOpen = signal(false);
  readonly draftCondition = signal<unknown | null>(null);
  readonly editorState = signal<RuleBuilderState | null>(null);
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
    const state = this.runtime.state();
    if (state.kind !== 'ready') return;
    this.catalog.load('/projections/ergonx-rn013.v1.json', this.i18n.locale(), state.config).subscribe({
      next: decisions => {
        this.allDecisions.set(decisions);
        const initial = decisions.find(item => item.code === 'ERG-08382') ?? decisions[0] ?? null;
        if (initial) this.select(initial);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.permissionLimited.set(error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403));
        this.loadError.set(error instanceof Error ? error.message : 'PROJECTION_LOAD_FAILED');
      }
    });
  }

  updateQuery(value: string): void { this.query.set(value); }
  select(decision: DecisionSummary): void {
    this.selected.set(decision);
    this.authoringOpen.set(false);
    this.draftCondition.set(decision.condition);
    this.editorState.set(null);
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
    this.authoringOpen.set(true);
  }

  closeAuthoring(): void { this.authoringOpen.set(false); }
  updateDraft(condition: unknown): void { this.draftCondition.set(condition); }
  updateEditorState(state: RuleBuilderState): void { this.editorState.set(state); }
  resetDraft(): void {
    this.draftCondition.set(this.selected()?.condition ?? null);
    this.editorState.set(null);
  }
}
