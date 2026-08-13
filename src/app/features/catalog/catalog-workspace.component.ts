import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PolicyStudioI18n } from '../../core/i18n';
import { ProjectionCatalogService } from '../../core/projection-catalog.service';
import { DecisionSummary } from './catalog.fixture';
import { DecisionTimelineEvent } from './catalog.fixture';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'pax-catalog-workspace',
  imports: [FormsModule],
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
    this.timeline.set([]);
    const state = this.runtime.state();
    if (state.kind === 'ready' && decision.configDefinitionId) {
      this.catalog.timeline(decision.configDefinitionId, state.config).subscribe({
        next: events => this.timeline.set(events),
        error: () => this.timeline.set([])
      });
    }
  }
}
