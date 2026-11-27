import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  PraxisRelationshipGraphComponent,
  type PraxisRelationshipGraphNodeEvent
} from '@praxisui/list';
import type { DomainRuleTestRun } from '@praxisui/core';
import { humanizeDecisionTitle, stripLeadingDecisionCode } from '../../core/humanize-labels';
import { PolicyStudioI18n } from '../../core/i18n';
import type { StudioViewDepth } from '../../core/studio-shell-state.service';
import { StudioIconComponent, type StudioIconName } from '../../shared/studio-icon.component';
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
import { buildDecisionPlanGraph, type DagGraphLens } from './decision-plan-graph.builder';

export interface DagStageLane {
  readonly id: DecisionStageId;
  readonly index: number;
  readonly codeLabel: string;
  readonly titlePtBr: string;
  readonly titleEnUs: string;
  readonly shortTitlePtBr: string;
  readonly shortTitleEnUs: string;
  readonly purposeKey:
    | 'dagStagePurposeGuard'
    | 'dagStagePurposeDomain'
    | 'dagStagePurposePost'
    | 'dagStagePurposeTransform'
    | 'dagStagePurposeEffect';
  readonly decisions: readonly DecisionSummary[];
}

export interface DagNodeTraceSummary {
  readonly candidateOutcome: string;
  readonly activeOutcome: string;
  readonly divergent: boolean;
  readonly scenarioCount: number;
  readonly divergentScenarioKeys: readonly string[];
}

const VISIBLE_STAGE_CAP = 6;

const CANONICAL_STAGES: readonly {
  readonly id: DecisionStageId;
  readonly index: number;
  readonly codeLabel: string;
  readonly titlePtBr: string;
  readonly titleEnUs: string;
  readonly shortTitlePtBr: string;
  readonly shortTitleEnUs: string;
  readonly purposeKey: DagStageLane['purposeKey'];
}[] = [
  {
    id: 'PROTECTED_GUARD',
    index: 1,
    codeLabel: '01 · GUARD',
    titlePtBr: 'Pré-requisitos obrigatórios',
    titleEnUs: 'Required prerequisites',
    shortTitlePtBr: 'Pré-req.',
    shortTitleEnUs: 'Guards',
    purposeKey: 'dagStagePurposeGuard'
  },
  {
    id: 'DOMAIN_DECISION',
    index: 2,
    codeLabel: '02 · DOMAIN',
    titlePtBr: 'Regras de negócio',
    titleEnUs: 'Business rules',
    shortTitlePtBr: 'Negócio',
    shortTitleEnUs: 'Business',
    purposeKey: 'dagStagePurposeDomain'
  },
  {
    id: 'POST_DECISION',
    index: 3,
    codeLabel: '03 · POST',
    titlePtBr: 'Validações cruzadas',
    titleEnUs: 'Cross-validations',
    shortTitlePtBr: 'Cruzadas',
    shortTitleEnUs: 'Cross',
    purposeKey: 'dagStagePurposePost'
  },
  {
    id: 'TRANSFORMATION_INTENT',
    index: 4,
    codeLabel: '04 · TRANSFORM',
    titlePtBr: 'Ajustes automáticos',
    titleEnUs: 'Automatic adjustments',
    shortTitlePtBr: 'Ajustes',
    shortTitleEnUs: 'Adjust',
    purposeKey: 'dagStagePurposeTransform'
  },
  {
    id: 'EFFECT_INTENT',
    index: 5,
    codeLabel: '05 · EFFECT',
    titlePtBr: 'Consequências e registros',
    titleEnUs: 'Consequences and records',
    shortTitlePtBr: 'Efeitos',
    shortTitleEnUs: 'Effects',
    purposeKey: 'dagStagePurposeEffect'
  }
];

@Component({
  selector: 'pax-rule-decision-plan-dag',
  standalone: true,
  imports: [NgTemplateOutlet, StudioIconComponent, PraxisRelationshipGraphComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let viewMode = effectiveViewMode();
    @let activeStage = focusedStage();
    @let currentStageId = selectedStageId();

    <section
      class="plan-dag-surface"
      data-testid="rule-decision-plan-dag"
      [attr.aria-label]="isPtBr() ? 'Plano de execução DAG e ontologia do RuleSet' : 'RuleSet execution plan DAG and ontology'">
      <header class="dag-header">
        <div class="dag-header-copy">
          <p class="section-label">
            @if (viewDepthSignal() === 'technical') {
              {{ isPtBr() ? 'Topologia do RuleDecisionPlan (5 Estágios)' : 'RuleDecisionPlan Topology (5 Stages)' }}
            } @else {
              {{ isPtBr() ? 'Sequência de avaliação desta operação' : 'Operation evaluation sequence' }}
            }
          </p>
          <p class="dag-subtitle" data-testid="dag-causal-subtitle">
            {{ causalSubtitle() }}
          </p>
        </div>

        <div class="dag-header-controls">
          @if (viewDepthSignal() === 'technical') {
            <span class="dag-ruleset-badge" data-testid="dag-ruleset-key">
              <code>{{ selectedDecision()?.ruleSetKey }}</code>
            </span>
          }

          <div
            class="dag-view-toggle"
            role="group"
            data-testid="dag-view-mode-toggle"
            [attr.aria-label]="i18n.text('dagViewModeLabel')">
            <button
              type="button"
              class="dag-mode-btn"
              data-testid="dag-view-focused"
              [class.active]="viewMode === 'focused'"
              [attr.aria-pressed]="viewMode === 'focused'"
              (click)="setUserViewMode('focused')">
              {{ i18n.text('dagViewModeFocused') }}
            </button>
            <button
              type="button"
              class="dag-mode-btn"
              data-testid="dag-view-all"
              [class.active]="viewMode === 'all'"
              [attr.aria-pressed]="viewMode === 'all'"
              (click)="setUserViewMode('all')">
              {{ i18n.text('dagViewModeAll') }}
            </button>
          </div>
        </div>
      </header>

      <div
        class="dag-graph-frame"
        [class.is-impact]="graphLens() === 'impact'"
        data-testid="dag-relationship-graph-frame">
        <div class="dag-graph-bar">
          <div
            class="dag-view-toggle"
            role="group"
            [attr.aria-label]="i18n.text('dagGraphModeLabel')">
            <button
              type="button"
              class="dag-mode-btn"
              data-testid="dag-graph-mode-flow"
              [class.active]="graphLens() === 'flow'"
              [attr.aria-pressed]="graphLens() === 'flow'"
              (click)="setGraphLens('flow')">
              {{ i18n.text('dagGraphModeFlow') }}
            </button>
            <button
              type="button"
              class="dag-mode-btn"
              data-testid="dag-graph-mode-impact"
              [class.active]="graphLens() === 'impact'"
              [attr.aria-pressed]="graphLens() === 'impact'"
              (click)="setGraphLens('impact')">
              {{ i18n.text('dagGraphModeImpact') }}
            </button>
          </div>

          <div class="dag-graph-bar-tools">
            <div class="dag-graph-legend" aria-hidden="true">
              <span class="dag-legend-pill is-fixed">{{ i18n.text('overrideForbiddenShort') }}</span>
              <span class="dag-legend-pill is-param">{{ i18n.text('overrideParameterizableShort') }}</span>
              <span class="dag-legend-pill is-custom">{{ i18n.text('overrideEditableShort') }}</span>
              <span class="dag-legend-pill is-block">{{ isPtBr() ? 'Bloqueio obrigatório' : 'Mandatory block' }}</span>
            </div>

            <div
              class="dag-graph-zoom"
              role="group"
              data-testid="dag-graph-zoom-controls"
              [attr.aria-label]="i18n.text('dagGraphZoomGroupLabel')">
              <button
                type="button"
                class="dag-zoom-btn"
                data-testid="dag-graph-zoom-out"
                [attr.aria-label]="i18n.text('dagGraphZoomOut')"
                [attr.title]="i18n.text('dagGraphZoomOut')"
                (click)="planGraph.zoomOut()">
                −
              </button>
              <button
                type="button"
                class="dag-zoom-btn is-fit"
                data-testid="dag-graph-zoom-fit"
                [attr.aria-label]="i18n.text('dagGraphZoomFit')"
                [attr.title]="i18n.text('dagGraphZoomFit')"
                (click)="planGraph.fitToView()">
                {{ isPtBr() ? 'Ajustar' : 'Fit' }}
              </button>
              <button
                type="button"
                class="dag-zoom-btn"
                data-testid="dag-graph-zoom-in"
                [attr.aria-label]="i18n.text('dagGraphZoomIn')"
                [attr.title]="i18n.text('dagGraphZoomIn')"
                (click)="planGraph.zoomIn()">
                +
              </button>
            </div>
          </div>
        </div>

        <praxis-relationship-graph
          #planGraph
          data-testid="dag-relationship-graph"
          [graphId]="'decision-plan-' + (selectedDecision()?.key ?? 'default')"
          configPersistenceStrategy="volatile"
          [config]="graphModel().config"
          [dataset]="graphModel().dataset"
          [pathHighlight]="graphModel().pathHighlight"
          (nodeSelect)="onGraphNodeSelected($event)" />
      </div>

      <div
        class="dag-stepper"
        role="tablist"
        [attr.aria-label]="i18n.text('dagViewModeLabel')">
        @for (lane of lanes(); track lane.id; let idx = $index) {
          @let isFocused = focusedStageId() === lane.id;
          @let hasCurrentRule = currentStageId === lane.id;
          @let breakdown = stageAutonomyBreakdown(lane);
          <button
            type="button"
            role="tab"
            class="dag-step"
            [class.focused]="isFocused"
            [class.populated]="lane.decisions.length > 0"
            [class.has-current]="hasCurrentRule"
            [attr.aria-selected]="isFocused"
            [attr.tabindex]="isFocused ? 0 : -1"
            [attr.data-stage-id]="lane.id"
            [attr.data-testid]="viewMode === 'focused' ? 'dag-stage-' + lane.id : 'dag-step-' + lane.id"
            (click)="selectStageStep(lane.id)"
            (keydown)="onStepKeydown($event, idx)">
            <div class="step-top">
              <span class="step-index studio-mono">
                <pax-icon [name]="stageIcon(lane.id)" [size]="12" />
                <span>{{ viewDepthSignal() === 'technical' ? lane.codeLabel : '0' + lane.index }}</span>
              </span>
              <span class="step-indicators">
                @if (hasCurrentRule) {
                  <span class="step-here-pill" data-testid="dag-current-stage-marker">
                    {{ i18n.text('dagStageContainsCurrentRule') }}
                  </span>
                }
                <span class="lane-count">{{ lane.decisions.length }}</span>
              </span>
            </div>
            <strong class="step-title">
              <span class="step-title-full">{{ stageTitle(lane) }}</span>
              <span class="step-title-short" aria-hidden="true">{{ stageShortTitle(lane) }}</span>
            </strong>
            @if (breakdown; as bars) {
              <span class="step-autonomy-bar" aria-hidden="true">
                @if (bars.fixedPct > 0) {
                  <span class="bar-segment is-fixed" [style.width.%]="bars.fixedPct"></span>
                }
                @if (bars.paramPct > 0) {
                  <span class="bar-segment is-param" [style.width.%]="bars.paramPct"></span>
                }
                @if (bars.customPct > 0) {
                  <span class="bar-segment is-custom" [style.width.%]="bars.customPct"></span>
                }
              </span>
            }
          </button>
        }
      </div>

      @if (viewMode === 'focused' && activeStage) {
        @let visibleItems = visibleStageDecisions(activeStage);
        <div
          class="focused-stage-panel"
          role="tabpanel"
          data-testid="dag-focused-stage-panel"
          [attr.aria-label]="stageTitle(activeStage)">
          <div class="focused-stage-head">
            <div class="focused-stage-copy">
              <div class="focused-stage-title-row">
                <span class="lane-code studio-mono">
                  {{ viewDepthSignal() === 'technical' ? activeStage.codeLabel : '0' + activeStage.index }}
                </span>
                <strong>{{ stageTitle(activeStage) }}</strong>
                <span class="lane-count">{{ activeStage.decisions.length }}</span>
              </div>
              <p class="focused-stage-purpose">{{ i18n.text(activeStage.purposeKey) }}</p>
            </div>

            @if (currentStageId && activeStage.id !== currentStageId) {
              <button
                type="button"
                class="quiet-button dag-jump-btn"
                data-testid="dag-jump-current-stage"
                (click)="jumpToCurrentRuleStage()">
                <pax-icon name="arrow-left" [size]="14" />
                <span>{{ i18n.text('dagJumpToCurrentStage') }}</span>
              </button>
            }
          </div>

          @if (activeStage.decisions.length > 0) {
            <div class="stage-node-grid">
              @for (item of visibleItems; track item.key) {
                <ng-container
                  [ngTemplateOutlet]="decisionCard"
                  [ngTemplateOutletContext]="{ $implicit: item }" />
              }
            </div>

            @if (activeStage.decisions.length > stageVisibleCap) {
              @let isExpanded = isStageExpanded(activeStage.id);
              <div class="stage-expand-row">
                <button
                  type="button"
                  class="quiet-button stage-expand-btn"
                  data-testid="dag-stage-expand-btn"
                  [attr.aria-expanded]="isExpanded"
                  (click)="toggleStageExpanded(activeStage.id)">
                  <span>
                    {{
                      isExpanded
                        ? i18n.format('dagShowFewerStageRules', { visible: stageVisibleCap, count: activeStage.decisions.length })
                        : i18n.format('dagShowAllStageRules', { count: activeStage.decisions.length })
                    }}
                  </span>
                </button>
              </div>
            }
          } @else {
            <div class="focused-stage-empty" data-testid="dag-focused-empty-stage">
              <pax-icon name="info" [size]="16" />
              <p>{{ i18n.format('dagEmptyStageDetailed', { stage: stageTitle(activeStage) }) }}</p>
            </div>
          }
        </div>
      } @else {
        <div class="stacked-stage-tracks" data-testid="dag-all-stages-panel">
          @for (lane of lanes(); track lane.id) {
            <section
              class="stacked-stage-band"
              [class.populated]="lane.decisions.length > 0"
              [class.selected-lane]="isSelectedStage(lane.id)"
              [class.is-empty]="lane.decisions.length === 0"
              [attr.data-stage-band]="lane.id"
              [attr.data-testid]="'dag-stage-' + lane.id">
              <header class="band-header">
                <div class="band-title-wrap">
                  <span class="lane-code studio-mono">
                    {{ viewDepthSignal() === 'technical' ? lane.codeLabel : '0' + lane.index }}
                  </span>
                  <strong>{{ stageTitle(lane) }}</strong>
                  @if (isSelectedStage(lane.id)) {
                    <span class="step-here-pill">{{ i18n.text('dagStageContainsCurrentRule') }}</span>
                  }
                </div>
                <div class="band-meta">
                  @if (lane.decisions.length === 0) {
                    <span class="lane-empty">{{ i18n.format('dagEmptyStageDetailed', { stage: stageTitle(lane) }) }}</span>
                  }
                  <span class="lane-count">{{ lane.decisions.length }}</span>
                </div>
              </header>

              @if (lane.decisions.length > 0) {
                <div class="stage-node-grid is-all-stages">
                  @for (item of lane.decisions; track item.key) {
                    <ng-container
                      [ngTemplateOutlet]="decisionCard"
                      [ngTemplateOutletContext]="{ $implicit: item }" />
                  }
                </div>
              }
            </section>
          }
        </div>
      }

      <ng-template #decisionCard let-item>
        @let trace = nodeTrace(item);
        @let isSelectedNode = selectedDecision()?.key === item.key;
        <button
          type="button"
          class="dag-node"
          [class.selected]="isSelectedNode"
          [class.trace-divergent]="trace?.divergent"
          [attr.data-trace-outcome]="trace?.candidateOutcome ?? null"
          [attr.data-testid]="'dag-node-' + item.key"
          (click)="decisionSelected.emit(item)">
          <div class="node-top">
            <div class="node-top-badges">
              @if (isSelectedNode) {
                <span class="current-node-badge">{{ i18n.text('dagCurrentRuleBadge') }}</span>
              }
              @if (viewDepthSignal() === 'technical') {
                <code class="node-code">{{ item.code }}</code>
              }
            </div>
            <span class="policy-pill" [attr.data-policy]="resolveOverridePolicy(item)">
              <pax-icon [name]="overridePolicyIcon(resolveOverridePolicy(item))" [size]="12" />
              <span>{{ overridePolicyLabel(resolveOverridePolicy(item)) }}</span>
            </span>
          </div>
          <strong class="node-name">{{ displayNodeTitle(item) }}</strong>
          @if (viewDepthSignal() === 'technical') {
            <small class="node-key" [title]="item.key">{{ item.key }}</small>
          }
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
      </ng-template>

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

      @if (viewDepthSignal() === 'technical') {
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
      } @else {
        <footer class="dag-business-footer" data-testid="dag-business-footer">
          <span>{{ i18n.text('dagTechnicalHiddenNotice') }}</span>
          <button
            type="button"
            class="quiet-button dag-technical-cta"
            data-testid="dag-open-technical-details"
            (click)="technicalModeRequested.emit()">
            <span class="studio-mono" aria-hidden="true">&lt;/&gt;</span>
            <span>{{ i18n.text('openTechnicalCanvasHint') }}</span>
          </button>
        </footer>
      }
    </section>
  `,
  styles: [`
    :host {
      display: block;
      min-width: 0;
      max-width: 100%;
    }

    .plan-dag-surface {
      margin-top: var(--pax-space-4, 1rem);
      padding: var(--pax-space-4, 1rem);
      border: 1px solid var(--pax-color-outline-variant, rgba(128, 128, 128, 0.24));
      border-radius: var(--pax-radius-lg, 0.75rem);
      background: var(--pax-color-surface-container-low, rgba(128, 128, 128, 0.04));
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      container-type: inline-size;
      gap: var(--pax-space-3, 0.75rem);
      min-width: 0;
      max-width: 100%;
    }

    .dag-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--pax-space-3, 0.75rem);
      flex-wrap: wrap;
    }

    .dag-header-copy {
      min-width: 0;
      flex: 1 1 18rem;
    }

    .dag-header-controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--pax-space-2, 0.5rem);
    }

    .section-label {
      margin: 0;
      font-size: var(--pax-text-xs, 0.75rem);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--pax-color-on-surface-variant, inherit);
    }

    .dag-subtitle {
      margin: 0.25rem 0 0;
      font-size: var(--pax-text-sm, 0.8125rem);
      line-height: var(--pax-lh-sm, 1.45);
      color: var(--pax-color-on-surface-variant, inherit);
    }

    .dag-ruleset-badge {
      padding: 0.125rem var(--pax-space-2, 0.5rem);
      border-radius: var(--pax-radius-sm, 0.375rem);
      background: var(--pax-color-surface, transparent);
      border: 1px solid var(--pax-color-outline-variant, rgba(128, 128, 128, 0.24));
      font-size: var(--pax-text-xs, 0.75rem);
    }

    .dag-view-toggle {
      display: inline-flex;
      padding: 0.125rem;
      border-radius: var(--pax-radius-md, 0.5rem);
      border: 1px solid var(--pax-color-outline-variant, rgba(128, 128, 128, 0.24));
      background: var(--pax-color-surface, transparent);
      gap: 0.125rem;
    }

    .dag-mode-btn {
      border: 0;
      border-radius: var(--pax-radius-sm, 0.375rem);
      padding: 0.25rem var(--pax-space-2, 0.5rem);
      background: transparent;
      color: var(--pax-color-on-surface-variant, inherit);
      font: inherit;
      font-size: var(--pax-text-xs, 0.75rem);
      font-weight: 600;
      cursor: pointer;
    }

    .dag-mode-btn.active {
      background: var(--pax-color-primary-container, rgba(7, 100, 135, 0.14));
      color: var(--pax-color-on-primary-container, var(--pax-color-primary, inherit));
      font-weight: 700;
    }

    .dag-mode-btn:focus-visible,
    .dag-step:focus-visible,
    .dag-node:focus-visible {
      outline: 2px solid var(--pax-color-primary, currentColor);
      outline-offset: 2px;
    }

    .dag-stepper {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: var(--pax-space-2, 0.5rem);
      min-width: 0;
    }

    .step-title-short {
      display: none;
    }

    .dag-step {
      display: grid;
      align-content: start;
      gap: 0.375rem;
      padding: var(--pax-space-2, 0.5rem) var(--pax-space-3, 0.75rem);
      border-radius: var(--pax-radius-md, 0.5rem);
      border: 1px solid var(--pax-color-outline-variant, rgba(128, 128, 128, 0.24));
      border-style: dashed;
      background: transparent;
      color: var(--pax-color-on-surface-variant, inherit);
      text-align: left;
      font: inherit;
      cursor: pointer;
      min-width: 0;
      transition: border-color 140ms ease, background-color 140ms ease, color 140ms ease;
    }

    .dag-step.populated {
      border-style: solid;
      background: var(--pax-color-surface, #ffffff);
      color: var(--pax-color-on-surface, inherit);
    }

    .dag-step.has-current:not(.focused) {
      border-color: color-mix(in oklab, var(--pax-color-primary, #076487) 45%, var(--pax-color-outline-variant, #cbd5e1));
    }

    .dag-step.focused {
      border-style: solid;
      border-width: 2px;
      border-color: var(--pax-color-primary, currentColor);
      background: color-mix(in oklab, var(--pax-color-primary-container, #e0f2fe) 35%, var(--pax-color-surface, #ffffff));
      color: var(--pax-color-on-surface, inherit);
    }

    .step-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.25rem;
      min-width: 0;
    }

    .step-index,
    .lane-code {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.6875rem;
      color: var(--pax-color-on-surface-variant, inherit);
      font-weight: 700;
    }

    .step-autonomy-bar {
      display: flex;
      width: 100%;
      height: 3px;
      border-radius: var(--pax-radius-pill, 999px);
      overflow: hidden;
      background: var(--pax-color-surface-container, rgba(128, 128, 128, 0.14));
    }

    .step-autonomy-bar .bar-segment {
      height: 100%;
    }

    .step-autonomy-bar .bar-segment.is-fixed {
      background: var(--pax-color-outline, #64748b);
    }

    .step-autonomy-bar .bar-segment.is-param {
      background: var(--pax-color-primary, #076487);
    }

    .step-autonomy-bar .bar-segment.is-custom {
      background: var(--pax-color-success, #187457);
    }

    .step-indicators {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      flex-shrink: 0;
    }

    .step-here-pill {
      padding: 0.0625rem 0.375rem;
      border-radius: var(--pax-radius-pill, 999px);
      background: var(--pax-color-primary, #076487);
      color: var(--pax-color-on-primary, #ffffff);
      font-size: 0.6875rem;
      font-weight: 700;
      line-height: 1.3;
    }

    .step-title {
      font-size: var(--pax-text-xs, 0.75rem);
      line-height: 1.3;
      font-weight: 700;
      overflow-wrap: anywhere;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .lane-count {
      flex-shrink: 0;
      font-family: var(--pax-font-mono, monospace);
      font-size: var(--pax-text-xs, 0.75rem);
      padding: 0.0625rem 0.45rem;
      border-radius: var(--pax-radius-pill, 999px);
      background: var(--pax-color-surface-container, rgba(128, 128, 128, 0.14));
      color: var(--pax-color-on-surface, inherit);
    }

    @container (max-width: 740px) {
      .dag-stepper {
        gap: 0.35rem;
      }

      .dag-step {
        padding: 0.45rem 0.5rem;
        gap: 0.25rem;
      }

      .step-top {
        flex-wrap: wrap;
        gap: 0.2rem;
      }

      .step-here-pill {
        font-size: 0.625rem;
        padding: 0.0625rem 0.3rem;
      }

      .step-title-full {
        display: none;
      }

      .step-title-short {
        display: inline;
      }
    }

    @container (max-width: 500px) {
      .dag-stepper {
        grid-template-columns: repeat(5, minmax(6.75rem, 1fr));
        overflow-x: auto;
        padding-bottom: 0.25rem;
        scrollbar-width: thin;
      }
    }

    .focused-stage-panel {
      border: 0;
      border-top: 1px solid var(--pax-color-outline-variant, rgba(128, 128, 128, 0.22));
      border-radius: 0;
      padding: var(--pax-space-3, 0.75rem) 0 0;
      background: transparent;
      display: grid;
      gap: var(--pax-space-3, 0.75rem);
      min-width: 0;
    }

    .stacked-stage-band {
      border: 1px solid var(--pax-color-outline-variant, rgba(128, 128, 128, 0.22));
      border-radius: var(--pax-radius-md, 0.5rem);
      padding: var(--pax-space-3, 0.75rem) var(--pax-space-4, 1rem);
      background: var(--pax-color-surface, #ffffff);
      display: grid;
      gap: var(--pax-space-3, 0.75rem);
      min-width: 0;
    }

    .stacked-stage-tracks {
      display: grid;
      gap: var(--pax-space-3, 0.75rem);
      min-width: 0;
    }

    .stacked-stage-band.is-empty {
      padding: var(--pax-space-2, 0.5rem) var(--pax-space-3, 0.75rem);
      background: transparent;
      border-style: dashed;
      gap: 0;
    }

    .stacked-stage-band.selected-lane {
      border-color: color-mix(in oklab, var(--pax-color-primary, #076487) 60%, var(--pax-color-outline-variant, #cbd5e1));
    }

    .focused-stage-head,
    .band-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--pax-space-2, 0.5rem) var(--pax-space-3, 0.75rem);
    }

    .focused-stage-copy {
      display: grid;
      gap: 0.25rem;
      min-width: 0;
    }

    .focused-stage-title-row,
    .band-title-wrap {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--pax-space-2, 0.5rem);
      min-width: 0;
    }

    .focused-stage-title-row strong,
    .band-title-wrap strong {
      font-size: var(--pax-text-sm, 0.875rem);
    }

    .focused-stage-purpose {
      margin: 0;
      color: var(--pax-color-on-surface-variant, inherit);
      font-size: var(--pax-text-xs, 0.75rem);
      line-height: var(--pax-lh-xs, 1.4);
    }

    .band-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--pax-space-2, 0.5rem);
    }

    .dag-jump-btn,
    .stage-expand-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      min-height: 2rem;
      font-size: var(--pax-text-xs, 0.75rem);
    }

    .stage-node-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 17.5rem), 1fr));
      gap: var(--pax-space-2, 0.5rem);
      min-width: 0;
    }

    .stage-node-grid.is-all-stages {
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 15.5rem), 1fr));
    }

    .dag-node {
      text-align: left;
      padding: var(--pax-space-3, 0.75rem);
      border-radius: var(--pax-radius-md, 0.5rem);
      border: 1px solid var(--pax-color-outline-variant, rgba(128, 128, 128, 0.25));
      background: var(--pax-color-surface-container-low, transparent);
      cursor: pointer;
      display: grid;
      align-content: start;
      gap: 0.375rem;
      color: inherit;
      font: inherit;
      min-width: 0;
      max-width: 100%;
    }

    .dag-node:hover {
      border-color: var(--pax-color-primary, currentColor);
    }

    .dag-node.selected {
      border-width: 2px;
      border-color: var(--pax-color-primary, currentColor);
      background: color-mix(in oklab, var(--pax-color-primary-container, #e0f2fe) 30%, var(--pax-color-surface, #ffffff));
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

    .node-top-badges {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem;
      min-width: 0;
    }

    .current-node-badge {
      padding: 0.0625rem 0.45rem;
      border-radius: var(--pax-radius-pill, 999px);
      background: var(--pax-color-primary, #076487);
      color: var(--pax-color-on-primary, #ffffff);
      font-size: 0.6875rem;
      font-weight: 700;
    }

    .node-code {
      font-family: var(--pax-font-mono, monospace);
      font-size: var(--pax-text-xs, 0.75rem);
      overflow-wrap: anywhere;
      min-width: 0;
    }

    .policy-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: var(--pax-text-xs, 0.75rem);
      font-weight: 600;
      padding: 0.1rem 0.45rem;
      border-radius: var(--pax-radius-pill, 999px);
      border: 1px solid var(--pax-policy-locked-border, rgba(128, 128, 128, 0.24));
      background: var(--pax-policy-locked-bg, rgba(128, 128, 128, 0.14));
      color: var(--pax-policy-locked-fg, inherit);
    }

    .policy-pill[data-policy="PARAMETERIZABLE"] {
      background: var(--pax-policy-param-bg, #eef7fa);
      color: var(--pax-policy-param-fg, #0a3b52);
      border-color: var(--pax-policy-param-border, #b4daea);
    }

    .policy-pill[data-policy="REPLACEABLE"],
    .policy-pill[data-policy="RESTRICT_ONLY"],
    .policy-pill[data-policy="EXTEND_ONLY"] {
      background: var(--pax-policy-custom-bg, #ecfdf5);
      color: var(--pax-policy-custom-fg, #065f46);
      border-color: var(--pax-policy-custom-border, #a7f3d0);
    }

    .node-name {
      font-size: var(--pax-text-sm, 0.8125rem);
      line-height: 1.4;
      overflow-wrap: anywhere;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .node-key {
      display: block;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--pax-text-xs, 0.75rem);
      opacity: 0.72;
      font-family: var(--pax-font-mono, monospace);
    }

    .node-trace-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.3rem;
      margin-top: 0.125rem;
    }

    .trace-outcome-pill,
    .trace-divergence-pill {
      font-size: var(--pax-text-xs, 0.75rem);
      font-family: var(--pax-font-mono, monospace);
      padding: 0.08rem 0.4rem;
      border-radius: 4px;
      background: rgba(128, 128, 128, 0.14);
    }

    .trace-outcome-pill[data-outcome="ALLOW"] {
      background: var(--pax-color-success-container, rgba(22, 163, 74, 0.16));
      color: var(--pax-color-on-success-container, #15803d);
    }

    .trace-outcome-pill[data-outcome="DENY"] {
      background: var(--pax-color-error-container, rgba(220, 38, 38, 0.16));
      color: var(--pax-color-on-error-container, #b91c1c);
    }

    .trace-divergence-pill {
      background: var(--pax-color-warning-container, rgba(217, 119, 6, 0.18));
      color: var(--pax-color-on-warning-container, #b45309);
      font-weight: 700;
    }

    .stage-expand-row {
      display: flex;
      justify-content: flex-start;
    }

    .focused-stage-empty {
      display: flex;
      align-items: center;
      gap: var(--pax-space-2, 0.5rem);
      padding: var(--pax-space-3, 0.75rem);
      border-radius: var(--pax-radius-sm, 0.375rem);
      background: var(--pax-color-surface-container-low, rgba(128, 128, 128, 0.06));
      color: var(--pax-color-on-surface-variant, #42545c);
      font-size: var(--pax-text-sm, 0.8125rem);
    }

    .focused-stage-empty p,
    .lane-empty {
      margin: 0;
      font-size: var(--pax-text-xs, 0.75rem);
      color: var(--pax-color-on-surface-variant, #42545c);
    }

    .dag-business-footer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem 0.75rem;
      padding-top: 0.65rem;
      border-top: 1px solid var(--pax-color-outline-variant, rgba(128, 128, 128, 0.18));
      font-size: var(--pax-text-xs, 0.75rem);
      color: var(--pax-color-on-surface-variant, #42545c);
    }

    .dag-technical-cta {
      min-height: 1.875rem;
      padding: 0.25rem 0.6rem;
      font-size: var(--pax-text-xs, 0.75rem);
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
      border-top: 1px solid var(--pax-color-outline-variant, rgba(128, 128, 128, 0.18));
      font-size: var(--pax-text-xs, 0.75rem);
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
      padding: 0.125rem 0.45rem;
      border-radius: 4px;
      background: rgba(128, 128, 128, 0.12);
      border: 1px solid transparent;
      color: inherit;
      font-size: var(--pax-text-xs, 0.75rem);
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
      font-size: var(--pax-text-xs, 0.75rem);
      padding: 0 0.35rem;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.16);
    }

    .neighbor-link {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      border: 1px solid var(--pax-color-outline-variant, rgba(128, 128, 128, 0.28));
      background: var(--pax-color-surface, transparent);
      color: inherit;
      cursor: pointer;
      font-size: var(--pax-text-xs, 0.75rem);
    }

    .lineage-detail {
      display: block;
      width: 100%;
      color: var(--pax-color-on-surface-variant, #42545c);
    }

    @media (prefers-reduced-motion: reduce) {
      .dag-step {
        transition: none;
      }
    }
  `]
})
export class RuleDecisionPlanDagComponent {
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly i18n = inject(PolicyStudioI18n);
  readonly stageVisibleCap = VISIBLE_STAGE_CAP;

  readonly selectedDecision = signal<DecisionSummary | null>(null);
  readonly allDecisions = signal<readonly DecisionSummary[]>([]);
  readonly sandboxRunSignal = signal<PolicySandboxRun | null>(null);
  readonly latestTestRunSignal = signal<DomainRuleTestRun | null>(null);
  readonly viewDepthSignal = signal<StudioViewDepth>('business');
  readonly activeConceptRoot = signal<string | null>(null);
  readonly focusedStageId = signal<DecisionStageId>('DOMAIN_DECISION');
  readonly userViewMode = signal<'focused' | 'all' | null>(null);
  readonly graphLens = signal<DagGraphLens>('flow');
  readonly expandedStages = signal<ReadonlySet<DecisionStageId>>(new Set());

  @Input({ required: true })
  set selected(value: DecisionSummary | null) {
    const previous = this.selectedDecision();
    this.selectedDecision.set(value);
    if ((value?.ruleSetKey ?? null) !== (previous?.ruleSetKey ?? null)) {
      this.expandedStages.set(new Set());
    }
    if ((value?.key ?? null) !== (previous?.key ?? null)) {
      this.activeConceptRoot.set(null);
      if (value) {
        this.focusedStageId.set(this.resolveStage(value));
      }
    } else if (value && previous === null) {
      this.focusedStageId.set(this.resolveStage(value));
    }
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

  @Input()
  set viewDepth(value: StudioViewDepth | null | undefined) {
    const next: StudioViewDepth = value === 'technical' ? 'technical' : 'business';
    const prev = this.viewDepthSignal();
    this.viewDepthSignal.set(next);
    if (next !== prev) {
      this.userViewMode.set(null);
    }
  }

  @Output() readonly decisionSelected = new EventEmitter<DecisionSummary>();
  @Output() readonly conceptRootSelected = new EventEmitter<string>();
  @Output() readonly technicalModeRequested = new EventEmitter<void>();

  readonly isPtBr = computed(() => this.i18n.locale() === 'pt-BR');

  readonly effectiveViewMode = computed<'focused' | 'all'>(
    () => this.userViewMode() ?? (this.viewDepthSignal() === 'technical' ? 'all' : 'focused')
  );

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

  readonly selectedStageId = computed<DecisionStageId | null>(() => {
    const current = this.selectedDecision();
    return current ? this.resolveStage(current) : null;
  });

  readonly focusedStage = computed<DagStageLane | null>(() => {
    const targetId = this.focusedStageId();
    const list = this.lanes();
    return list.find(stage => stage.id === targetId) ?? list[0] ?? null;
  });

  readonly causalSubtitle = computed(() => {
    if (this.effectiveViewMode() === 'all') {
      if (this.viewDepthSignal() === 'technical') {
        return this.isPtBr()
          ? 'Sequência determinística de avaliação do conjunto de regras, políticas de override por slot e raízes ontológicas.'
          : 'Deterministic evaluation sequence of the RuleSet, per-slot override policies, and ontological roots.';
      }
      return this.isPtBr()
        ? 'Veja em que etapa esta regra atua e clique em qualquer cartão para comparar.'
        : 'See the exact step where each criterion runs and click any card to inspect.';
    }
    const active = this.focusedStage();
    if (!active) return '';
    const currentId = this.selectedStageId();
    const currentLane = currentId ? this.lanes().find(lane => lane.id === currentId) : null;
    if (!currentLane || active.id === currentLane.id) {
      return this.i18n.format('dagCausalCurrentStage', {
        index: active.index,
        total: CANONICAL_STAGES.length,
        stage: this.stageTitle(active)
      });
    }
    return this.i18n.format('dagCausalBrowsingOther', {
      index: active.index,
      total: CANONICAL_STAGES.length,
      stage: this.stageTitle(active),
      currentIndex: currentLane.index,
      currentStage: this.stageTitle(currentLane)
    });
  });

  stageTitle(lane: Pick<DagStageLane, 'titlePtBr' | 'titleEnUs'>): string {
    return this.isPtBr() ? lane.titlePtBr : lane.titleEnUs;
  }

  stageShortTitle(lane: Pick<DagStageLane, 'shortTitlePtBr' | 'shortTitleEnUs'>): string {
    return this.isPtBr() ? lane.shortTitlePtBr : lane.shortTitleEnUs;
  }

  setUserViewMode(mode: 'focused' | 'all'): void {
    this.userViewMode.set(mode);
  }

  selectStageStep(stageId: DecisionStageId): void {
    this.focusedStageId.set(stageId);
    if (this.effectiveViewMode() === 'all') {
      const band = this.hostRef.nativeElement.querySelector<HTMLElement>(`[data-stage-band="${stageId}"]`);
      band?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  jumpToCurrentRuleStage(): void {
    const currentId = this.selectedStageId();
    if (currentId) {
      this.focusedStageId.set(currentId);
    }
  }

  onStepKeydown(event: KeyboardEvent, index: number): void {
    const stages = this.lanes();
    if (stages.length === 0) return;
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % stages.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + stages.length) % stages.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = stages.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const target = stages[nextIndex];
    if (!target) return;
    this.selectStageStep(target.id);
    requestAnimationFrame(() => {
      this.hostRef.nativeElement
        .querySelector<HTMLButtonElement>(`[data-stage-id="${target.id}"]`)
        ?.focus();
    });
  }

  visibleStageDecisions(lane: DagStageLane): readonly DecisionSummary[] {
    if (this.isStageExpanded(lane.id) || lane.decisions.length <= this.stageVisibleCap) {
      return lane.decisions;
    }
    const base = lane.decisions.slice(0, this.stageVisibleCap);
    const current = this.selectedDecision();
    if (current && lane.decisions.some(item => item.key === current.key) && !base.some(item => item.key === current.key)) {
      return [...lane.decisions.slice(0, this.stageVisibleCap - 1), current];
    }
    return base;
  }

  isStageExpanded(stageId: DecisionStageId): boolean {
    return this.expandedStages().has(stageId);
  }

  toggleStageExpanded(stageId: DecisionStageId): void {
    const next = new Set(this.expandedStages());
    if (next.has(stageId)) next.delete(stageId);
    else next.add(stageId);
    this.expandedStages.set(next);
  }

  displayNodeTitle(item: DecisionSummary): string {
    const docTitle =
      item.workspaceDocumentation?.title ??
      item.documentation?.title ??
      item.definitionDocumentation?.title;
    const title = humanizeDecisionTitle(item.name, item.code, docTitle, this.viewDepthSignal(), this.i18n.locale());
    return this.viewDepthSignal() === 'technical'
      ? stripLeadingDecisionCode(title, item.code)
      : title;
  }

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

  readonly graphModel = computed(() =>
    buildDecisionPlanGraph({
      selectedDecision: this.selectedDecision(),
      lanes: this.lanes(),
      viewDepth: this.viewDepthSignal(),
      locale: this.i18n.locale(),
      graphLens: this.graphLens(),
      traceOverview: this.traceOverview(),
      nodeTrace: item => this.nodeTrace(item),
      resolveOverridePolicy: item => this.resolveOverridePolicy(item),
      overridePolicyLabel: policy => this.overridePolicyLabel(policy),
      displayNodeTitle: item => this.displayNodeTitle(item),
      conceptNeighborGroups: this.conceptNeighborGroups()
    })
  );

  setGraphLens(lens: DagGraphLens): void {
    this.graphLens.set(lens);
  }

  onGraphNodeSelected(event: PraxisRelationshipGraphNodeEvent): void {
    const rawContainer = event.raw as Record<string, unknown> | undefined;
    const nestedRaw =
      rawContainer && typeof rawContainer['raw'] === 'object' && rawContainer['raw'] !== null
        ? (rawContainer['raw'] as Record<string, unknown>)
        : undefined;
    const attrs = event.node?.attributes as Record<string, unknown> | undefined;
    const meta = (attrs ?? nestedRaw ?? rawContainer ?? event.node?.raw) as
      | { decisionKey?: unknown; jumpStageId?: unknown; conceptRoot?: unknown }
      | undefined;

    const nodeId = event.node?.id ?? (typeof rawContainer?.['id'] === 'string' ? rawContainer['id'] : '');

    const decisionKey =
      typeof meta?.decisionKey === 'string'
        ? meta.decisionKey
        : nodeId.startsWith('rule:')
          ? nodeId.slice('rule:'.length)
          : null;
    if (decisionKey) {
      const match =
        this.ruleSetDecisions().find(item => item.key === decisionKey)
        ?? this.allDecisions().find(item => item.key === decisionKey);
      if (match) {
        if (match.key !== this.selectedDecision()?.key) {
          this.decisionSelected.emit(match);
        } else {
          this.jumpToCurrentRuleStage();
        }
        return;
      }
    }

    const validStages: readonly DecisionStageId[] = [
      'PROTECTED_GUARD',
      'DOMAIN_DECISION',
      'POST_DECISION',
      'TRANSFORMATION_INTENT',
      'EFFECT_INTENT'
    ];
    let jumpStageId: DecisionStageId | null =
      typeof meta?.jumpStageId === 'string' && validStages.includes(meta.jumpStageId as DecisionStageId)
        ? (meta.jumpStageId as DecisionStageId)
        : null;
    if (!jumpStageId && nodeId.startsWith('bucket:')) {
      const candidateStage = nodeId.split(':')[1] as DecisionStageId | undefined;
      if (candidateStage && validStages.includes(candidateStage)) {
        jumpStageId = candidateStage;
      }
    }
    if (!jumpStageId && nodeId === 'node:blocked') {
      jumpStageId = 'PROTECTED_GUARD';
    }
    if (jumpStageId) {
      this.selectStageStep(jumpStageId);
      return;
    }

    const conceptRoot =
      typeof meta?.conceptRoot === 'string'
        ? meta.conceptRoot
        : nodeId.startsWith('concept:')
          ? nodeId.slice('concept:'.length)
          : null;
    if (conceptRoot) {
      this.selectConceptRoot(conceptRoot);
    }
  }

  stageIcon(stageId: DecisionStageId): StudioIconName {
    switch (stageId) {
      case 'PROTECTED_GUARD':
        return 'shield-check';
      case 'DOMAIN_DECISION':
        return 'sliders';
      case 'POST_DECISION':
        return 'layers';
      case 'TRANSFORMATION_INTENT':
        return 'sparkles';
      case 'EFFECT_INTENT':
        return 'activity';
    }
  }

  stageAutonomyBreakdown(
    lane: DagStageLane
  ): { readonly fixedPct: number; readonly paramPct: number; readonly customPct: number } | null {
    const total = lane.decisions.length;
    if (total === 0) {
      return null;
    }
    let fixed = 0;
    let param = 0;
    let custom = 0;
    for (const item of lane.decisions) {
      const policy = this.resolveOverridePolicy(item);
      if (policy === 'FORBIDDEN' || policy === 'LOCKED') {
        fixed += 1;
      } else if (policy === 'PARAMETERIZABLE') {
        param += 1;
      } else {
        custom += 1;
      }
    }
    return {
      fixedPct: (fixed / total) * 100,
      paramPct: (param / total) * 100,
      customPct: (custom / total) * 100
    };
  }

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

  overridePolicyIcon(policy: SlotOverridePolicyId): StudioIconName {
    switch (policy) {
      case 'PARAMETERIZABLE':
        return 'sliders';
      case 'REPLACEABLE':
      case 'RESTRICT_ONLY':
      case 'EXTEND_ONLY':
        return 'pencil';
      case 'FORBIDDEN':
      case 'LOCKED':
        return 'lock';
    }
  }

  overridePolicyLabel(policy: SlotOverridePolicyId): string {
    if (this.viewDepthSignal() !== 'technical') {
      switch (policy) {
        case 'FORBIDDEN':
        case 'LOCKED':
          return this.i18n.text('overrideForbiddenShort');
        case 'PARAMETERIZABLE':
          return this.i18n.text('overrideParameterizableShort');
        case 'REPLACEABLE':
        case 'RESTRICT_ONLY':
        case 'EXTEND_ONLY':
          return this.i18n.text('overrideEditableShort');
      }
    }
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
