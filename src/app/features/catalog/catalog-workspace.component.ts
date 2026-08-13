import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PolicyStudioI18n } from '../../core/i18n';
import { DECISION_FIXTURE, DecisionSummary } from './catalog.fixture';

@Component({
  selector: 'pax-catalog-workspace',
  imports: [FormsModule],
  templateUrl: './catalog-workspace.component.html',
  styleUrl: './catalog-workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CatalogWorkspaceComponent {
  readonly query = signal('');
  readonly selected = signal<DecisionSummary>(DECISION_FIXTURE[1]);
  readonly decisions = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    return query
      ? DECISION_FIXTURE.filter(item => `${item.code} ${item.name} ${item.domain}`.toLocaleLowerCase().includes(query))
      : DECISION_FIXTURE;
  });

  constructor(readonly i18n: PolicyStudioI18n) {}

  updateQuery(value: string): void { this.query.set(value); }
  select(decision: DecisionSummary): void { this.selected.set(decision); }
}
