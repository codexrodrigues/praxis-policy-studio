import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal, untracked } from '@angular/core';
import { RuleEditorComponent, type RuleBuilderConfig, type RuleBuilderState } from '@praxisui/visual-builder';
import {
  compileDecisionTableProjection,
  editableDecisionCondition,
  extractDecisionTableProjection,
  formatDecisionExpression,
  type DecisionComparisonOperator,
  type DecisionTableClause,
  type DecisionTableProjection
} from '../../core/decision-inspection';
import { PolicyStudioI18n } from '../../core/i18n';

export type DecisionRepresentationMode = 'tree' | 'table' | 'expression';

interface FieldOption {
  readonly path: string;
  readonly label: string;
  readonly valueType: string;
}

@Component({
  selector: 'pax-local-draft-workspace',
  imports: [RuleEditorComponent],
  template: `
    <div class="representation-toolbar" role="group" [attr.aria-label]="i18n.text('representationModeLabel')" data-testid="representation-mode-switcher">
      <button
        type="button"
        class="quiet-button"
        data-testid="representation-mode-tree"
        [class.active-mode]="representationMode() === 'tree'"
        [attr.aria-pressed]="representationMode() === 'tree'"
        (click)="showTree()">
        {{ i18n.text('representationModeTree') }}
      </button>
      <button
        type="button"
        class="quiet-button"
        data-testid="representation-mode-table"
        [class.active-mode]="representationMode() === 'table'"
        [attr.aria-pressed]="representationMode() === 'table'"
        (click)="representationMode.set('table')">
        {{ i18n.text('representationModeTable') }}
      </button>
      <button
        type="button"
        class="quiet-button"
        data-testid="representation-mode-expression"
        [class.active-mode]="representationMode() === 'expression'"
        [attr.aria-pressed]="representationMode() === 'expression'"
        (click)="representationMode.set('expression')">
        {{ i18n.text('representationModeExpression') }}
      </button>
    </div>

    <div [hidden]="representationMode() !== 'tree'">
      @for (session of treeSessions(); track session.key) {
        <praxis-rule-editor
          [embedded]="true"
          mode="condition"
          [config]="config()"
          [initialCondition]="$any(session.condition)"
          (conditionChanged)="conditionChanged.emit($event)"
          (stateChanged)="stateChanged.emit($event)" />
      }
    </div>
    @switch (representationMode()) {
      @case ('table') {
        <section class="representation-surface" data-testid="decision-table-representation" [attr.aria-label]="i18n.text('representationModeTable')">
          <div class="table-combinator">
            <label>
              <span>{{ i18n.text('decisionTableCombinator') }}</span>
              <select
                data-testid="decision-table-combinator"
                [disabled]="!tableEditable() || tableProjection().clauses.length < 2"
                [value]="tableProjection().combinator"
                (change)="updateCombinator($any($event.target).value)">
                <option value="and">{{ i18n.text('decisionTableCombinatorAnd') }}</option>
                <option value="or">{{ i18n.text('decisionTableCombinatorOr') }}</option>
              </select>
            </label>
            <button
              type="button"
              class="quiet-button"
              data-testid="decision-table-add-clause"
              [disabled]="!tableEditable() || !fieldOptions().length"
              (click)="addTableClause()">
              {{ i18n.text('decisionTableAddClause') }}
            </button>
          </div>
          @if (treeInvalid()) {
            <p class="representation-note" role="status">{{ i18n.text('decisionTableIncompleteTreeHint') }}</p>
          } @else if (!tableProjection().lossless) {
            <p class="representation-note" role="status" data-testid="decision-table-readonly-hint">{{ i18n.text('decisionTableComplexHint') }}</p>
          }
          @if (tableProjection().clauses.length) {
            <div class="clause-table" role="table" [attr.aria-label]="i18n.text('representationModeTable')">
              <div class="clause-row clause-header" role="row">
                <span role="columnheader">{{ i18n.text('decisionTableFactColumn') }}</span>
                <span role="columnheader">{{ i18n.text('decisionTableOperatorColumn') }}</span>
                <span role="columnheader">{{ i18n.text('decisionTableValueColumn') }}</span>
                <span role="columnheader">{{ i18n.text('decisionActions') }}</span>
              </div>
              @for (clause of tableProjection().clauses; track $index; let idx = $index) {
                <div class="clause-row" role="row" [attr.data-testid]="'decision-table-row-' + idx">
                  <div role="cell">
                    <select
                      [attr.aria-label]="i18n.text('decisionTableFactColumn') + ' ' + (idx + 1)"
                      [attr.data-testid]="'decision-table-fact-' + idx"
                      [disabled]="!tableEditable()"
                      [value]="clause.factPath"
                      (change)="updateClauseFact(idx, $any($event.target).value)">
                      @for (field of fieldOptions(); track field.path) {
                        <option [value]="field.path">{{ field.label }} ({{ field.path }})</option>
                      }
                      @if (!hasFieldOption(clause.factPath)) {
                        <option [value]="clause.factPath">{{ clause.factPath }}</option>
                      }
                    </select>
                  </div>
                  <div role="cell">
                    <select
                      [attr.aria-label]="i18n.text('decisionTableOperatorColumn') + ' ' + (idx + 1)"
                      [attr.data-testid]="'decision-table-operator-' + idx"
                      [disabled]="!tableEditable()"
                      [value]="clause.operator"
                      (change)="updateClauseOperator(idx, $any($event.target).value)">
                      @for (op of operators; track op) {
                        <option [value]="op">{{ op }}</option>
                      }
                    </select>
                  </div>
                  <div role="cell">
                    <input
                      type="text"
                      [attr.aria-label]="i18n.text('decisionTableValueColumn') + ' ' + (idx + 1)"
                      [attr.data-testid]="'decision-table-value-' + idx"
                      [disabled]="!tableEditable()"
                      [value]="clause.rawValue"
                      (input)="updateClauseValue(idx, $any($event.target).value)" />
                  </div>
                  <div role="cell">
                    <button
                      type="button"
                      class="quiet-button"
                      [attr.data-testid]="'decision-table-remove-' + idx"
                      [disabled]="!tableEditable()"
                      (click)="removeTableClause(idx)">
                      {{ i18n.text('decisionTableRemoveClause') }}
                    </button>
                  </div>
                </div>
              }
            </div>
          } @else {
            <p class="representation-note">{{ i18n.text('noCondition') }}</p>
          }
        </section>
      }
      @case ('expression') {
        <section class="representation-surface" data-testid="decision-expression-representation" [attr.aria-label]="i18n.text('representationModeExpression')">
          <p class="representation-note">{{ i18n.text('decisionExpressionHint') }}</p>
          <code class="domain-expression-block" data-testid="decision-domain-expression">{{ domainExpression() ?? '—' }}</code>
          @if (tableProjection().clauses.length) {
            <ul class="expression-clause-list">
              @for (clause of tableProjection().clauses; track $index) {
                <li>
                  <strong>{{ labelForFact(clause.factPath) }}</strong>
                  <code>{{ clause.operator }}</code>
                  <span>{{ clause.rawValue }}</span>
                </li>
              }
            </ul>
          }
        </section>
      }
    }
  `,
  styles: [`
    :host { display: grid; gap: .75rem; min-width: 0; }
    .representation-toolbar { display: flex; flex-wrap: wrap; gap: .45rem; padding-bottom: .5rem; border-bottom: 1px solid var(--pax-color-outline-variant, #8c9ca4); }
    .representation-toolbar button.active-mode { border-color: var(--pax-color-primary, #005f73); color: var(--pax-color-primary, #005f73); font-weight: 750; background: var(--pax-color-surface-container-low, #f4f7f8); }
    .representation-surface { display: grid; gap: .65rem; min-width: 0; }
    .table-combinator { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: .65rem; }
    .table-combinator label { display: grid; gap: .25rem; font-size: .78rem; font-weight: 700; }
    .clause-table { display: grid; gap: .45rem; }
    .clause-row { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(5.5rem, .6fr) minmax(0, 1.2fr) auto; gap: .5rem; align-items: center; }
    .clause-header { font-size: .75rem; font-weight: 750; color: var(--pax-color-on-surface-variant, #455a64); }
    select, input { width: 100%; min-width: 0; border: 1px solid var(--pax-color-outline-variant, #8c9ca4); border-radius: .45rem; padding: .45rem .55rem; background: var(--pax-color-surface, #fff); color: inherit; font: inherit; font-size: .82rem; }
    .domain-expression-block { display: block; padding: .65rem .75rem; border-left: 3px solid var(--pax-color-primary, #005f73); background: var(--pax-color-surface-container-low, #f4f7f8); font-size: .84rem; overflow-wrap: anywhere; }
    .expression-clause-list { margin: 0; padding-left: 1.1rem; display: grid; gap: .3rem; font-size: .8rem; }
    .expression-clause-list li { display: flex; flex-wrap: wrap; gap: .4rem; align-items: baseline; }
    .representation-note { margin: 0; font-size: .78rem; color: var(--pax-color-on-surface-variant, #455a64); }
    @media (max-width: 48rem) {
      .clause-header { display: none; }
      .clause-row { grid-template-columns: 1fr; padding-bottom: .5rem; border-bottom: 1px solid var(--pax-color-outline-variant, #8c9ca4); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LocalDraftWorkspaceComponent {
  readonly config = input.required<RuleBuilderConfig>();
  readonly condition = input.required<unknown>();
  readonly treeInvalid = input.required<boolean>();
  readonly source = input.required<{ readonly condition: unknown }>();
  readonly conditionChanged = output<unknown>();
  readonly stateChanged = output<RuleBuilderState | null>();
  readonly i18n = inject(PolicyStudioI18n);

  readonly representationMode = signal<DecisionRepresentationMode>('tree');
  // Keep the graph and its undo history until an external replacement or a table edit.
  readonly treeSessions = linkedSignal(() => {
    const source = this.source();
    return untracked(this.representationMode) === 'tree' ? this.newTreeSession(editableDecisionCondition(source.condition)) : [];
  });

  showTree(): void {
    if (!this.treeSessions().length) {
      this.treeSessions.set(this.newTreeSession(this.condition()));
    }
    this.representationMode.set('tree');
  }

  readonly operators: readonly DecisionComparisonOperator[] = ['<=', '<', '>=', '>', '===', '!==', '==', '!=', 'in'];

  readonly fieldOptions = computed<readonly FieldOption[]>(() => {
    const schemas = (this.config() as unknown as { fieldSchemas?: Record<string, { name?: string; label?: string; type?: string }> })?.fieldSchemas ?? {};
    return Object.entries(schemas).map(([key, schema]) => ({
      path: schema?.name || key,
      label: schema?.label || key,
      valueType: schema?.type || 'string'
    }));
  });

  readonly factLabels = computed<Readonly<Record<string, string>>>(() =>
    Object.fromEntries(this.fieldOptions().map(item => [item.path, item.label]))
  );

  readonly tableProjection = computed<DecisionTableProjection>(() =>
    extractDecisionTableProjection(this.condition())
  );

  readonly tableEditable = computed(() => this.tableProjection().lossless && !this.treeInvalid());

  readonly domainExpression = computed<string | null>(() =>
    formatDecisionExpression(this.condition(), this.factLabels())
  );

  hasFieldOption(path: string): boolean {
    return this.fieldOptions().some(item => item.path === path);
  }

  labelForFact(path: string): string {
    return this.factLabels()[path] ?? path;
  }

  updateCombinator(combinatorRaw: string): void {
    const combinator: 'and' | 'or' = combinatorRaw === 'or' ? 'or' : 'and';
    const current = this.tableProjection();
    if (current.clauses.length >= 2) this.emitTableProjection({ ...current, combinator });
  }

  addTableClause(): void {
    const current = this.tableProjection();
    const firstField = this.fieldOptions()[0];
    if (!firstField) return;
    const factPath = firstField.path;
    const valueKind = this.inferValueKind(firstField.valueType, '<=');
    const defaultRaw = valueKind === 'number' ? '0' : valueKind === 'boolean' ? 'true' : '';
    const nextClause: DecisionTableClause = {
      factPath,
      operator: '<=',
      rawValue: defaultRaw,
      valueKind
    };
    this.emitTableProjection({
      ...current,
      clauses: [...current.clauses, nextClause]
    });
  }

  removeTableClause(index: number): void {
    const current = this.tableProjection();
    const clauses = current.clauses.filter((_, idx) => idx !== index);
    this.emitTableProjection({ ...current, clauses });
  }

  updateClauseFact(index: number, factPath: string): void {
    const field = this.fieldOptions().find(item => item.path === factPath);
    const current = this.tableProjection();
    const clauses = current.clauses.map((clause, idx) =>
      idx === index
        ? {
            ...clause,
            factPath,
            valueKind: this.inferValueKind(field?.valueType, clause.operator)
          }
        : clause
    );
    this.emitTableProjection({ ...current, clauses });
  }

  updateClauseOperator(index: number, operatorRaw: string): void {
    const operator = (this.operators.includes(operatorRaw as DecisionComparisonOperator)
      ? operatorRaw
      : '<=') as DecisionComparisonOperator;
    const current = this.tableProjection();
    const clauses = current.clauses.map((clause, idx) => {
      if (idx !== index) return clause;
      const field = this.fieldOptions().find(item => item.path === clause.factPath);
      return {
        ...clause,
        operator,
        valueKind: operator === 'in' ? 'array' : this.inferValueKind(field?.valueType, operator)
      };
    });
    this.emitTableProjection({ ...current, clauses });
  }

  updateClauseValue(index: number, rawValue: string): void {
    const current = this.tableProjection();
    const clauses = current.clauses.map((clause, idx) =>
      idx === index
        ? {
            ...clause,
            rawValue,
            valueKind: /^(?:parameters|params)\./.test(rawValue.trim()) ? 'var' : clause.valueKind
          }
        : clause
    );
    this.emitTableProjection({ ...current, clauses });
  }

  private newTreeSession(condition: unknown) {
    return [{ key: Symbol('tree-session'), condition }];
  }

  private inferValueKind(
    valueType: string | undefined,
    operator: DecisionComparisonOperator
  ): DecisionTableClause['valueKind'] {
    if (operator === 'in') return 'array';
    if (valueType === 'number') return 'number';
    if (valueType === 'boolean') return 'boolean';
    return 'string';
  }

  private emitTableProjection(projection: DecisionTableProjection): void {
    if (!this.tableEditable()) return;
    const compiled = compileDecisionTableProjection(projection);
    this.treeSessions.set([]);
    this.stateChanged.emit(null);
    this.conditionChanged.emit(compiled);
  }
}
