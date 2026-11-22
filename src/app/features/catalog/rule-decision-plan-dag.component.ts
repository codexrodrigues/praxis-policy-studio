import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal
} from '@angular/core';
import type { DomainRuleTestRun } from '@praxisui/core';
import { PolicyStudioI18n } from '../../core/i18n';
import {
  buildConceptRootNeighborhood,
  type ConceptRootNeighborGroup
} from './catalog-presentation';
import type {
  DecisionStageId,
  DecisionSummary,
  PolicySandboxRun,
  PolicySandboxScenarioResult,
  SlotOverridePolicyId
} from './catalog.fixture';

export interface DagStageLane {
  readonly id: DecisionStageId;
  readonly index: number;
  readonly codeLabel: string;
  readonly titlePtBr: string;
  readonly titleEnUs: string;
  readonly decisions: readonly DecisionSummary[];
}

export interface DagNodeTraceSummary {
  readonly candidateOutcome: string;
  readonly activeOutcome: string;
  readonly divergent: boolean;
  readonly scenarioCount: number;
  readonly divergentScenarioKeys: readonly string[];
}

const CANONICAL_STAGES: readonly {
  readonly id: DecisionStageId;
  readonly index: number;
  readonly codeLabel: string;
  readonly titlePtBr: string;
  readonly titleEnUs: string;
}[] = [
  {
    id: 'PROTECTED_GUARD',
    index: 1,
    codeLabel: '01 · GUARD',
    titlePtBr: 'Pré-requisitos obrigatórios',
    titleEnUs: 'Required prerequisites'
  },
  {
    id: 'DOMAIN_DECISION',
    index: 2,
    codeLabel: '02 · DOMAIN',
    titlePtBr: 'Regras de negócio',
    titleEnUs: 'Business rules'
  },
  {
    id: 'POST_DECISION',
    index: 3,
    codeLabel: '03 · POST',
    titlePtBr: 'Validações cruzadas',
    titleEnUs: 'Cross-validations'
  },
  {
    id: 'TRANSFORMATION_INTENT',
    index: 4,
    codeLabel: '04 · TRANSFORM',
    titlePtBr: 'Ajustes automáticos',
    titleEnUs: 'Automatic adjustments'
  },
  {
    id: 'EFFECT_INTENT',
    index: 5,
    codeLabel: '05 · EFFECT',
    titlePtBr: 'Consequências e registros',
    titleEnUs: 'Consequences and records'
  }
];

@Component({
  selector: 'pax-rule-decision-plan-dag',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="plan-dag-surface"
      data-testid="rule-decision-plan-dag"
      [attr.aria-label]="isPtBr() ? 'Plano de execução DAG e ontologia do RuleSet' : 'RuleSet execution plan DAG and ontology'">
      <header class="dag-header">
        <div>
          <p class="section-label">
            {{ isPtBr() ? 'Topologia do RuleDecisionPlan (5 Estágios)' : 'RuleDecisionPlan Topology (5 Stages)' }}
          </p>
          <p class="dag-subtitle">
            {{ isPtBr()
              ? 'Sequência determinística de avaliação do conjunto de regras, políticas de override por slot e raízes ontológicas.'
              : 'Deterministic evaluation sequence of the RuleSet, per-slot override policies, and ontological roots.' }}
          </p>
        </div>
        <span class="dag-ruleset-badge" data-testid="dag-ruleset-key">
          <code>{{ selectedDecision()?.ruleSetKey }}</code>
        </span>
      </header>

      <div class="dag-svg-strip" aria-hidden="true">
        <svg viewBox="0 0 600 44" preserveAspectRatio="none">
          @for (lane of lanes(); track lane.id; let idx = $index; let last = $last) {
            <g [attr.transform]="'translate(' + (idx * 120 + 8) + ', 6)'">
              <rect
                x="0"
                y="0"
                width="96"
                height="32"
                rx="6"
                [attr.class]="'svg-stage-box ' + (lane.decisions.length > 0 ? 'populated' : 'empty') + (isSelectedStage(lane.id) ? ' active' : '')" />
              <text x="48" y="20" text-anchor="middle" class="svg-stage-text">
                {{ lane.codeLabel }} ({{ lane.decisions.length }})
              </text>
              @if (!last) {
                <line x1="96" y1="16" x2="120" y2="16" class="svg-stage-edge" />
              }
            </g>
          }
        </svg>
      </div>

      <div class="dag-lanes" role="list">
        @for (lane of lanes(); track lane.id) {
          <div
            class="dag-lane"
            role="listitem"
            [class.populated]="lane.decisions.length > 0"
            [class.selected-lane]="isSelectedStage(lane.id)"
            [attr.data-testid]="'dag-stage-' + lane.id">
            <header class="lane-header">
              <span class="lane-code">{{ lane.codeLabel }}</span>
              <strong>{{ isPtBr() ? lane.titlePtBr : lane.titleEnUs }}</strong>
              <span class="lane-count">{{ lane.decisions.length }}</span>
            </header>
            <div class="lane-nodes">
              @for (item of lane.decisions; track item.key) {
                @let trace = nodeTrace(item);
                <button
                  type="button"
                  class="dag-node"
                  [class.selected]="selectedDecision()?.key === item.key"
                  [class.trace-divergent]="trace?.divergent"
                  [attr.data-trace-outcome]="trace?.candidateOutcome ?? null"
                  [attr.data-testid]="'dag-node-' + item.key"
                  (click)="decisionSelected.emit(item)">
                  <div class="node-top">
                    <code class="node-code">{{ item.code }}</code>
                    <span class="policy-pill" [attr.data-policy]="resolveOverridePolicy(item)">
                      {{ overridePolicyLabel(resolveOverridePolicy(item)) }}
                    </span>
                  </div>
                  <strong class="node-name">{{ item.name }}</strong>
                  <small class="node-key">{{ item.key }}</small>
                  @if (trace) {
                    <div class="node-trace-row" [attr.data-testid]="'dag-node-trace-' + item.key">
                      <span class="trace-outcome-pill" [attr.data-outcome]="trace.candidateOutcome">
                        {{ traceOutcomeLabel(trace.candidateOutcome) }}
                      </span>
                      @if (trace.divergent) {
                        <span
                          class="trace-divergence-pill"
                          [attr.data-testid]="'dag-node-divergence-' + item.key">
                          ≠ {{ isPtBr() ? 'Divergência' : 'Divergent' }} ({{ trace.activeOutcome }} → {{ trace.candidateOutcome }})
                        </span>
                      }
                    </div>
                  }
                </button>
              } @empty {
                <p class="lane-empty">{{ isPtBr() ? 'Sem slots neste estágio' : 'No slots in this stage' }}</p>
              }
            </div>
          </div>
        }
      </div>

      @if (traceOverview(); as summary) {
        <div class="trace-summary-bar" data-testid="dag-simulation-trace-summary">
          <span class="roots-label">
            {{ isPtBr() ? 'Trace de Simulação (Candidato × Ativo):' : 'Simulation Trace (Candidate × Active):' }}
          </span>
          <code>{{ summary.scenarioCount }} {{ isPtBr() ? 'cenário(s)' : 'scenario(s)' }}</code>
          ·
          <span>
            {{ isPtBr() ? 'Candidato:' : 'Candidate:' }}
            <code [attr.data-outcome]="summary.candidateOutcome">{{ summary.candidateOutcome }}</code>
          </span>
          ·
          <span>
            {{ isPtBr() ? 'Ativo:' : 'Active:' }}
            <code>{{ summary.activeOutcome }}</code>
          </span>
          @if (summary.divergent) {
            ·
            <strong class="trace-divergence-pill" data-testid="dag-trace-divergence-banner">
              ≠ {{ isPtBr() ? 'Divergência em' : 'Divergence in' }} {{ summary.divergentScenarioKeys.join(', ') }}
            </strong>
          }
        </div>
      }

      @if (ontologyRoots().available.length > 0 || ontologyRoots().concepts.length > 0) {
        <div class="ontology-roots-bar" data-testid="dag-ontology-roots">
          <div class="roots-group">
            <span class="roots-label">
              {{ isPtBr() ? 'Raízes ontológicas (availableRoots):' : 'Ontological roots (availableRoots):' }}
            </span>
            @for (root of ontologyRoots().available; track root) {
              @if (hasConceptGroup(root)) {
                <button
                  type="button"
                  class="root-chip interactive"
                  [class.active-root]="activeConceptRoot() === root"
                  [attr.data-testid]="'dag-root-chip-' + root"
                  (click)="selectConceptRoot(root)">
                  <code>{{ root }}</code>
                </button>
              } @else {
                <code class="root-chip">{{ root }}</code>
              }
            }
          </div>
          @if (ontologyRoots().concepts.length > 0) {
            <div class="roots-group">
              <span class="roots-label">
                {{ isPtBr() ? 'Vizinhança 1-Hop (conceptRoots):' : '1-Hop Neighborhood (conceptRoots):' }}
              </span>
              @for (concept of ontologyRoots().concepts; track concept) {
                <button
                  type="button"
                  class="root-chip concept interactive"
                  [class.active-root]="activeConceptRoot() === concept"
                  [attr.data-testid]="'dag-concept-chip-' + concept"
                  (click)="selectConceptRoot(concept)">
                  <code>{{ concept }}</code>
                  @if (neighborCountForRoot(concept) > 0) {
                    <small class="neighbor-badge">{{ neighborCountForRoot(concept) }}</small>
                  }
                </button>
              }
            </div>
          }
        </div>
      }

      @if (conceptNeighborGroups().length > 0) {
        <div class="concept-neighborhood-bar" data-testid="dag-concept-neighborhood">
          <span class="roots-label">
            {{ isPtBr() ? 'Navegação 1-Hop entre RuleSets:' : '1-Hop Cross-RuleSet Navigation:' }}
          </span>
          @for (group of visibleNeighborGroups(); track group.root) {
            <div class="neighbor-group" [attr.data-testid]="'dag-neighbor-group-' + group.root">
              <code class="root-chip concept">{{ group.root }}</code>
              @for (neighbor of group.neighborDecisions.slice(0, 6); track neighbor.key) {
                <button
                  type="button"
                  class="neighbor-link"
                  [attr.data-testid]="'dag-neighbor-' + neighbor.key"
                  (click)="decisionSelected.emit(neighbor)">
                  <strong>{{ neighbor.code }}</strong>
                  <small>{{ neighbor.ruleSetKey }}</small>
                </button>
              } @empty {
                <small class="lane-empty">
                  {{ isPtBr() ? 'Sem outros slots carregados nesta raiz' : 'No other slots loaded on this root' }}
                </small>
              }
            </div>
          }
        </div>
      }

      @if (selectedDecision()?.legacyOccurrence; as legacy) {
        <div class="legacy-lineage-card" data-testid="dag-legacy-lineage">
          <span class="roots-label">
            {{ isPtBr() ? 'Linhagem Reconciliada (PL/SQL / Origem):' : 'Reconciled Lineage (PL/SQL / Origin):' }}
          </span>
          <code>{{ legacy.code }}</code>
          @if (legacy.plsqlOrigin) {
            · <code>{{ legacy.plsqlOrigin }}</code>
          }
          @if (legacy.targetField) {
            · <small>{{ isPtBr() ? 'Campo:' : 'Field:' }} <code>{{ legacy.targetField }}</code></small>
          }
          @if (legacy.plsqlLineage) {
            <small class="lineage-detail">{{ legacy.plsqlLineage }}</small>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .plan-dag-surface {
      margin-top: 1rem;
      padding: 1rem;
      border: 1px solid var(--line, rgba(128, 128, 128, 0.24));
      border-radius: 8px;
      background: var(--surface-subtle, rgba(128, 128, 128, 0.04));
      display: grid;
      gap: 0.75rem;
      min-width: 0;
      max-width: 100%;
    }
    .dag-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .section-label {
      margin: 0;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .dag-subtitle {
      margin: 0.2rem 0 0;
      font-size: 0.82rem;
      opacity: 0.78;
    }
    .dag-svg-strip svg {
      width: 100%;
      height: 44px;
      display: block;
    }
    .svg-stage-box {
      fill: rgba(128, 128, 128, 0.08);
      stroke: rgba(128, 128, 128, 0.28);
      stroke-width: 1;
    }
    .svg-stage-box.populated {
      fill: rgba(37, 99, 235, 0.1);
      stroke: rgba(37, 99, 235, 0.45);
    }
    .svg-stage-box.active {
      stroke-width: 2;
      stroke: currentColor;
    }
    .svg-stage-text {
      font-size: 9px;
      font-family: monospace;
      fill: currentColor;
    }
    .svg-stage-edge {
      stroke: rgba(128, 128, 128, 0.45);
      stroke-width: 1.5;
      stroke-dasharray: 3 2;
    }
    .dag-lanes {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 0.6rem;
    }
    @media (max-width: 1100px) {
      .dag-lanes {
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      }
    }
    .dag-lane {
      border: 1px solid var(--line, rgba(128, 128, 128, 0.22));
      border-radius: 6px;
      padding: 0.6rem;
      display: grid;
      align-content: start;
      gap: 0.45rem;
      background: var(--pax-color-surface-container-low, #f4f6f7);
    }
    .dag-lane.populated {
      background: var(--pax-color-surface-container-lowest, #fff);
    }
    .dag-lane.selected-lane {
      border-color: currentColor;
    }
    .lane-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.35rem;
      font-size: 0.76rem;
    }
    .lane-code {
      font-family: monospace;
      font-size: 0.68rem;
      color: var(--pax-color-on-surface-variant, #42545c);
    }
    .lane-count {
      font-family: monospace;
      font-size: 0.72rem;
      padding: 0.05rem 0.35rem;
      border-radius: 999px;
      background: rgba(128, 128, 128, 0.14);
    }
    .lane-nodes {
      display: grid;
      gap: 0.4rem;
    }
    .dag-node {
      text-align: left;
      padding: 0.45rem 0.55rem;
      border-radius: 5px;
      border: 1px solid var(--line, rgba(128, 128, 128, 0.25));
      background: var(--surface, transparent);
      cursor: pointer;
      display: grid;
      gap: 0.15rem;
      color: inherit;
      min-width: 0;
      max-width: 100%;
    }
    .dag-node.selected {
      border-width: 2px;
      border-color: currentColor;
      font-weight: 600;
    }
    .dag-node[data-trace-outcome="ALLOW"] {
      border-color: rgba(22, 163, 74, 0.55);
      background: rgba(22, 163, 74, 0.05);
    }
    .dag-node[data-trace-outcome="DENY"] {
      border-color: rgba(220, 38, 38, 0.55);
      background: rgba(220, 38, 38, 0.05);
    }
    .dag-node.trace-divergent {
      box-shadow: 0 0 0 1px rgba(217, 119, 6, 0.65);
    }
    .node-top {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 0.35rem;
      min-width: 0;
    }
    .node-code {
      font-size: 0.7rem;
      overflow-wrap: anywhere;
      min-width: 0;
    }
    .policy-pill {
      font-size: 0.64rem;
      font-family: monospace;
      padding: 0.05rem 0.3rem;
      border-radius: 4px;
      background: rgba(128, 128, 128, 0.14);
    }
    .node-name {
      font-size: 0.78rem;
      line-height: 1.25;
    }
    .node-key {
      font-size: 0.68rem;
      opacity: 0.7;
      font-family: monospace;
      word-break: break-all;
    }
    .node-trace-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.3rem;
      margin-top: 0.2rem;
    }
    .trace-outcome-pill,
    .trace-divergence-pill {
      font-size: 0.64rem;
      font-family: monospace;
      padding: 0.05rem 0.35rem;
      border-radius: 4px;
      background: rgba(128, 128, 128, 0.14);
    }
    .trace-outcome-pill[data-outcome="ALLOW"] {
      background: rgba(22, 163, 74, 0.16);
      color: #15803d;
    }
    .trace-outcome-pill[data-outcome="DENY"] {
      background: rgba(220, 38, 38, 0.16);
      color: #b91c1c;
    }
    .trace-divergence-pill {
      background: rgba(217, 119, 6, 0.18);
      color: #b45309;
      font-weight: 700;
    }
    .lane-empty {
      margin: 0;
      font-size: 0.72rem;
      color: var(--pax-color-on-surface-variant, #42545c);
    }
    .trace-summary-bar,
    .ontology-roots-bar,
    .concept-neighborhood-bar,
    .legacy-lineage-card {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.45rem 0.75rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--line, rgba(128, 128, 128, 0.18));
      font-size: 0.76rem;
    }
    .roots-group,
    .neighbor-group {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.3rem;
    }
    .roots-label {
      font-weight: 600;
      color: var(--pax-color-on-surface-variant, #42545c);
    }
    .root-chip {
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      background: rgba(128, 128, 128, 0.12);
      border: 1px solid transparent;
      color: inherit;
      font-size: 0.74rem;
    }
    .root-chip.concept {
      border: 1px dashed rgba(128, 128, 128, 0.4);
    }
    .root-chip.interactive {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
    .root-chip.active-root {
      border-color: currentColor;
      font-weight: 700;
    }
    .neighbor-badge {
      font-size: 0.65rem;
      padding: 0 0.28rem;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.16);
    }
    .neighbor-link {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      border: 1px solid var(--line, rgba(128, 128, 128, 0.28));
      background: var(--surface, transparent);
      color: inherit;
      cursor: pointer;
      font-size: 0.72rem;
    }
    .lineage-detail {
      display: block;
      width: 100%;
      color: var(--pax-color-on-surface-variant, #42545c);
    }
  `]
})
export class RuleDecisionPlanDagComponent {
  private readonly i18n = inject(PolicyStudioI18n);
  readonly selectedDecision = signal<DecisionSummary | null>(null);
  readonly allDecisions = signal<readonly DecisionSummary[]>([]);
  readonly sandboxRunSignal = signal<PolicySandboxRun | null>(null);
  readonly latestTestRunSignal = signal<DomainRuleTestRun | null>(null);
  readonly activeConceptRoot = signal<string | null>(null);

  @Input({ required: true })
  set selected(value: DecisionSummary | null) {
    this.selectedDecision.set(value);
    this.activeConceptRoot.set(null);
  }

  @Input()
  set decisions(value: readonly DecisionSummary[] | null | undefined) {
    this.allDecisions.set(value ?? []);
  }

  @Input()
  set sandboxRun(value: PolicySandboxRun | null | undefined) {
    this.sandboxRunSignal.set(value ?? null);
  }

  @Input()
  set latestTestRun(value: DomainRuleTestRun | null | undefined) {
    this.latestTestRunSignal.set(value ?? null);
  }

  @Output() readonly decisionSelected = new EventEmitter<DecisionSummary>();
  @Output() readonly conceptRootSelected = new EventEmitter<string>();

  readonly isPtBr = computed(() => this.i18n.locale() === 'pt-BR');

  readonly ruleSetDecisions = computed(() => {
    const current = this.selectedDecision();
    if (!current) return [] as readonly DecisionSummary[];
    const sameRuleSet = this.allDecisions().filter(item => item.ruleSetKey === current.ruleSetKey);
    return sameRuleSet.length > 0 ? sameRuleSet : [current];
  });

  readonly lanes = computed<readonly DagStageLane[]>(() => {
    const items = this.ruleSetDecisions();
    return CANONICAL_STAGES.map(stage => ({
      ...stage,
      decisions: items.filter(item => this.resolveStage(item) === stage.id)
    }));
  });

  readonly ontologyRoots = computed(() => {
    const current = this.selectedDecision();
    if (!current) return { available: [] as readonly string[], concepts: [] as readonly string[] };
    const explicitAvailable = current.availableRoots ?? [];
    const derivedRoots = [
      ...new Set(
        current.factPaths
          .map(path => path.split('.')[0]?.trim())
          .filter((root): root is string => !!root)
      )
    ];
    const available = explicitAvailable.length > 0 ? explicitAvailable : derivedRoots;
    const concepts = current.conceptRoots ?? [];
    return { available, concepts };
  });

  readonly conceptNeighborGroups = computed<readonly ConceptRootNeighborGroup[]>(() =>
    buildConceptRootNeighborhood(this.selectedDecision(), this.allDecisions())
  );

  readonly visibleNeighborGroups = computed<readonly ConceptRootNeighborGroup[]>(() => {
    const active = this.activeConceptRoot();
    const groups = this.conceptNeighborGroups();
    if (!active) return groups;
    const filtered = groups.filter(group => group.root === active);
    return filtered.length > 0 ? filtered : groups;
  });

  private readonly normalizedTraceResults = computed<readonly PolicySandboxScenarioResult[]>(() => {
    const liveRun = this.sandboxRunSignal();
    if (liveRun?.results?.length) {
      return liveRun.results;
    }
    const latest = this.latestTestRunSignal();
    if (!latest?.results?.length) {
      return [];
    }
    return latest.results.map((result, idx) => ({
      scenarioId: result.scenarioId ?? `scenario-${idx + 1}`,
      scenarioKey: result.scenarioKey ?? `scenario-${idx + 1}`,
      expectedDecision: String(result.expectedDecision ?? 'ALLOW'),
      candidateDecision: String(result.candidateDecision ?? 'ALLOW'),
      activeDecision: String(result.activeDecision ?? result.candidateDecision ?? 'ALLOW'),
      comparison: String(result.comparison ?? 'CANDIDATE_MATCH'),
      candidateMatchesExpected: Boolean(result.candidateMatchesExpected ?? true),
      activeMatchesExpected: Boolean(result.activeMatchesExpected ?? true),
      candidateReasonCodes: result.candidateReasonCodes ?? [],
      activeReasonCodes: result.activeReasonCodes ?? []
    }));
  });

  readonly traceOverview = computed<DagNodeTraceSummary | null>(() => {
    const results = this.normalizedTraceResults();
    if (results.length === 0) return null;
    return this.summarizeTraceResults(results);
  });

  nodeTrace(item: DecisionSummary): DagNodeTraceSummary | null {
    const results = this.normalizedTraceResults();
    if (results.length === 0) return null;
    const current = this.selectedDecision();
    if (current && item.key === current.key) {
      return this.summarizeTraceResults(results);
    }
    const code = item.code?.trim();
    if (!code) return null;
    const matching = results.filter(
      res => res.candidateReasonCodes.includes(code) || res.activeReasonCodes.includes(code)
    );
    if (matching.length === 0) return null;
    const candidateTriggered = matching.some(res => res.candidateReasonCodes.includes(code));
    const activeTriggered = matching.some(res => res.activeReasonCodes.includes(code));
    const divergentScenarios = matching
      .filter(res => res.candidateReasonCodes.includes(code) !== res.activeReasonCodes.includes(code))
      .map(res => res.scenarioKey);
    return {
      candidateOutcome: candidateTriggered ? 'DENY' : 'ALLOW',
      activeOutcome: activeTriggered ? 'DENY' : 'ALLOW',
      divergent: divergentScenarios.length > 0,
      scenarioCount: matching.length,
      divergentScenarioKeys: divergentScenarios
    };
  }

  private summarizeTraceResults(results: readonly PolicySandboxScenarioResult[]): DagNodeTraceSummary {
    const pickDominantOutcome = (outcomes: readonly string[]): string => {
      const upper = outcomes.map(o => o.toUpperCase());
      if (upper.includes('TECHNICAL_ERROR')) return 'TECHNICAL_ERROR';
      if (upper.includes('DENY')) return 'DENY';
      if (upper.includes('INCONCLUSIVE')) return 'INCONCLUSIVE';
      if (upper.includes('NOT_APPLICABLE')) return 'NOT_APPLICABLE';
      return upper[0] ?? 'ALLOW';
    };
    const candidateOutcome = pickDominantOutcome(results.map(r => r.candidateDecision));
    const activeOutcome = pickDominantOutcome(results.map(r => r.activeDecision));
    const divergentScenarioKeys = results
      .filter(
        r =>
          r.candidateDecision.toUpperCase() !== r.activeDecision.toUpperCase()
          || r.comparison.toUpperCase().includes('MISMATCH')
      )
      .map(r => r.scenarioKey);
    return {
      candidateOutcome,
      activeOutcome,
      divergent: divergentScenarioKeys.length > 0,
      scenarioCount: results.length,
      divergentScenarioKeys
    };
  }

  traceOutcomeLabel(outcome: string): string {
    const normalized = outcome.toUpperCase();
    if (normalized === 'NOT_APPLICABLE') return 'BYPASS';
    return normalized;
  }

  hasConceptGroup(root: string): boolean {
    return this.conceptNeighborGroups().some(group => group.root === root);
  }

  neighborCountForRoot(root: string): number {
    return this.conceptNeighborGroups().find(group => group.root === root)?.neighborDecisions.length ?? 0;
  }

  selectConceptRoot(root: string): void {
    const next = this.activeConceptRoot() === root ? null : root;
    this.activeConceptRoot.set(next);
    this.conceptRootSelected.emit(root);
  }

  resolveStage(decision: DecisionSummary): DecisionStageId {
    if (decision.decisionStage) return decision.decisionStage;
    const key = decision.key.toLowerCase();
    const ruleType = (decision.ruleType ?? '').toLowerCase();
    if (key.includes('guard') || decision.slotOverridePolicy === 'FORBIDDEN' || decision.slotOverridePolicy === 'LOCKED') {
      return 'PROTECTED_GUARD';
    }
    if (key.includes('transform') || ruleType.includes('determination') || ruleType.includes('calculation')) {
      return 'TRANSFORMATION_INTENT';
    }
    if (key.includes('effect') || key.includes('audit') || key.includes('notify')) {
      return 'EFFECT_INTENT';
    }
    if (key.includes('post')) {
      return 'POST_DECISION';
    }
    return 'DOMAIN_DECISION';
  }

  resolveOverridePolicy(decision: DecisionSummary): SlotOverridePolicyId {
    if (decision.slotOverridePolicy) return decision.slotOverridePolicy;
    if ((decision.parameterCatalog?.parameters.length ?? 0) > 0) return 'PARAMETERIZABLE';
    if (!decision.authoringSupported) return 'FORBIDDEN';
    return 'REPLACEABLE';
  }

  overridePolicyLabel(policy: SlotOverridePolicyId): string {
    if (this.isPtBr()) {
      switch (policy) {
        case 'FORBIDDEN': return 'GUARD · FIXO';
        case 'LOCKED': return this.i18n.text('overridePolicyLocked');
        case 'PARAMETERIZABLE': return 'PARAMETRIZÁVEL';
        case 'REPLACEABLE': return 'SUBSTITUÍVEL';
        case 'RESTRICT_ONLY': return 'RESTRITIVO (+AND)';
        case 'EXTEND_ONLY': return 'EXTENSÍVEL';
      }
    }
    switch (policy) {
      case 'FORBIDDEN': return 'GUARD · FIXED';
      case 'LOCKED': return this.i18n.text('overridePolicyLocked');
      case 'PARAMETERIZABLE': return 'PARAMETERIZABLE';
      case 'REPLACEABLE': return 'REPLACEABLE';
      case 'RESTRICT_ONLY': return 'RESTRICT ONLY';
      case 'EXTEND_ONLY': return 'EXTEND ONLY';
    }
  }

  isSelectedStage(stageId: DecisionStageId): boolean {
    const current = this.selectedDecision();
    return current !== null && this.resolveStage(current) === stageId;
  }
}
