import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PolicyStudioI18n } from '../../core/i18n';
import { ProjectionCatalogService } from '../../core/projection-catalog.service';
import { DecisionSummary } from './catalog.fixture';

@Component({
  selector: 'pax-catalog-workspace',
  imports: [FormsModule],
  templateUrl: './catalog-workspace.component.html',
  styleUrl: './catalog-workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CatalogWorkspaceComponent implements OnInit {
  private readonly catalog = inject(ProjectionCatalogService);
  readonly query = signal('');
  readonly allDecisions = signal<readonly DecisionSummary[]>([]);
  readonly selected = signal<DecisionSummary | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly decisions = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    return query
      ? this.allDecisions().filter(item => `${item.code} ${item.name} ${item.domain}`.toLocaleLowerCase().includes(query))
      : this.allDecisions();
  });

  constructor(readonly i18n: PolicyStudioI18n) {}

  ngOnInit(): void {
    this.catalog.load('/projections/ergonx-rn013.v1.json', this.i18n.locale()).subscribe({
      next: decisions => {
        this.allDecisions.set(decisions);
        this.selected.set(decisions.find(item => item.code === 'ERG-08382') ?? decisions[0] ?? null);
      },
      error: (error: unknown) => this.loadError.set(error instanceof Error ? error.message : 'PROJECTION_LOAD_FAILED')
    });
  }

  updateQuery(value: string): void { this.query.set(value); }
  select(decision: DecisionSummary): void { this.selected.set(decision); }
}
