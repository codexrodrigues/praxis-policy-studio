import type {
  PraxisRelationshipGraphConfig,
  PraxisRelationshipGraphDataset,
  PraxisRelationshipGraphEdge,
  PraxisRelationshipGraphGroup,
  PraxisRelationshipGraphNode,
  PraxisRelationshipGraphPathHighlight,
  PraxisRelationshipGraphTone,
  PraxisRelationshipGraphVerdict
} from '@praxisui/list';
import { formatFactDisplayLabel, partitionDecisionFacts } from '../../core/fact-presentation';
import { humanizeTechnicalSlug } from '../../core/humanize-labels';
import type { SupportedLocale } from '../../core/runtime-config';
import type { StudioViewDepth } from '../../core/studio-shell-state.service';
import type { ConceptRootNeighborGroup } from './catalog-presentation';
import type { DecisionStageId, DecisionSummary, SlotOverridePolicyId } from './catalog.fixture';
import type { DagNodeTraceSummary, DagStageLane } from './rule-decision-plan-dag.component';

export type DagGraphLens = 'flow' | 'impact';

export interface DecisionPlanGraphInput {
  readonly selectedDecision: DecisionSummary | null;
  readonly lanes: readonly DagStageLane[];
  readonly viewDepth: StudioViewDepth;
  readonly locale: SupportedLocale;
  readonly graphLens: DagGraphLens;
  readonly traceOverview: DagNodeTraceSummary | null;
  readonly nodeTrace: (item: DecisionSummary) => DagNodeTraceSummary | null;
  readonly resolveOverridePolicy: (item: DecisionSummary) => SlotOverridePolicyId;
  readonly overridePolicyLabel: (policy: SlotOverridePolicyId) => string;
  readonly displayNodeTitle: (item: DecisionSummary) => string;
  readonly conceptNeighborGroups: readonly ConceptRootNeighborGroup[];
}

export interface BuiltDecisionPlanGraph {
  readonly config: PraxisRelationshipGraphConfig;
  readonly dataset: PraxisRelationshipGraphDataset;
  readonly pathHighlight: PraxisRelationshipGraphPathHighlight | null;
}

const DENSE_STAGE_THRESHOLD = 4;
const MAX_FEATURED_PEER_NODES = 2;
const MAX_IMPACT_FACTS = 4;
const MAX_IMPACT_CONCEPTS = 2;
const MAX_NEIGHBORS_PER_CONCEPT = 1;
const MAX_IMPACT_FALLBACK_PEERS = 4;

type AutonomyBucketKey = 'fixed' | 'parameterizable' | 'customizable';

function truncateLabel(value: string, maxLength = 42): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function classifyAutonomyBucket(policy: SlotOverridePolicyId): AutonomyBucketKey {
  if (policy === 'FORBIDDEN' || policy === 'LOCKED') {
    return 'fixed';
  }
  if (policy === 'PARAMETERIZABLE') {
    return 'parameterizable';
  }
  return 'customizable';
}

function policyTone(policy: SlotOverridePolicyId): PraxisRelationshipGraphTone {
  switch (classifyAutonomyBucket(policy)) {
    case 'fixed':
      return 'neutral';
    case 'parameterizable':
      return 'info';
    case 'customizable':
      return 'success';
  }
}

function policyIcon(policy: SlotOverridePolicyId): string {
  switch (classifyAutonomyBucket(policy)) {
    case 'fixed':
      return 'lock';
    case 'parameterizable':
      return 'tune';
    case 'customizable':
      return 'edit';
  }
}

function stageTone(stageId: DecisionStageId): PraxisRelationshipGraphTone {
  switch (stageId) {
    case 'PROTECTED_GUARD':
      return 'primary';
    case 'DOMAIN_DECISION':
      return 'info';
    case 'POST_DECISION':
      return 'warning';
    case 'TRANSFORMATION_INTENT':
      return 'violet';
    case 'EFFECT_INTENT':
      return 'success';
  }
}

function buildAppearanceTokens(): Record<string, string> {
  return {
    '--prx-rg-surface': 'transparent',
    '--prx-rg-surface-alt': 'var(--pax-color-surface-container-low)',
    '--prx-rg-surface-high': 'var(--pax-color-surface-container)',
    '--prx-rg-canvas-bg': 'var(--pax-color-surface-container-lowest)',
    '--prx-rg-label-bg': 'var(--pax-color-surface-container-lowest)',
    '--prx-rg-node-bg': 'var(--pax-color-surface)',
    '--prx-rg-text': 'var(--pax-color-on-surface)',
    '--prx-rg-text-muted': 'var(--pax-color-on-surface-variant)',
    '--prx-rg-border': 'var(--pax-color-outline-variant)',
    '--prx-rg-border-strong': 'var(--pax-color-outline)',
    '--prx-rg-edge-color': 'var(--pax-color-on-surface-variant)',
    '--prx-rg-tone-primary': 'var(--pax-color-primary)',
    '--prx-rg-tone-on-primary': 'var(--pax-color-on-primary)',
    '--prx-rg-tone-info': 'var(--pax-color-primary)',
    '--prx-rg-tone-success': 'var(--pax-color-success, var(--pax-color-tertiary))',
    '--prx-rg-tone-warning': 'var(--pax-color-warning)',
    '--prx-rg-tone-danger': 'var(--pax-color-error)',
    '--prx-rg-tone-violet': 'var(--pax-color-dev-accent)',
    '--prx-rg-evidence-observed': 'var(--pax-color-primary)',
    '--prx-rg-evidence-contextual': 'var(--pax-color-on-surface-variant)',
    '--prx-rg-evidence-inferred': 'var(--pax-color-dev-accent)'
  };
}

function buildTaxonomy(isPtBr: boolean) {
  return {
    nodeTypes: {
      entry: { label: isPtBr ? 'Entrada' : 'Entry', shape: 'pill' as const, tone: 'neutral' as const, icon: 'play_circle' },
      rule: { label: isPtBr ? 'Regra' : 'Rule', shape: 'card' as const, tone: 'primary' as const, icon: 'gavel' },
      bucket: { label: isPtBr ? 'Grupo de regras' : 'Rule group', shape: 'card' as const, tone: 'info' as const, icon: 'workspaces' },
      bypass: { label: isPtBr ? 'Passagem direta' : 'Pass-through', shape: 'pill' as const, tone: 'neutral' as const, icon: 'fast_forward' },
      blocked: { label: isPtBr ? 'Bloqueio' : 'Block', shape: 'diamond' as const, tone: 'danger' as const, icon: 'block' },
      approved: { label: isPtBr ? 'Decisão' : 'Decision', shape: 'pill' as const, tone: 'success' as const, icon: 'check_circle' },
      fact: { label: isPtBr ? 'Dado consultado' : 'Evaluated data', shape: 'pill' as const, tone: 'info' as const, icon: 'dataset' },
      concept: { label: isPtBr ? 'Conceito' : 'Concept', shape: 'pill' as const, tone: 'violet' as const, icon: 'hub' }
    }
  };
}

function buildRuleNode(
  item: DecisionSummary,
  stageId: DecisionStageId,
  input: DecisionPlanGraphInput
): PraxisRelationshipGraphNode {
  const isPtBr = input.locale === 'pt-BR';
  const isSelected = input.selectedDecision?.key === item.key;
  const policy = input.resolveOverridePolicy(item);
  const policyLabel = input.overridePolicyLabel(policy);
  const trace = input.nodeTrace(item);

  let tone: PraxisRelationshipGraphTone = isSelected ? 'primary' : policyTone(policy);
  if (trace?.divergent) {
    tone = 'warning';
  } else if (trace?.candidateOutcome === 'DENY') {
    tone = 'danger';
  } else if (trace?.candidateOutcome === 'ALLOW' && isSelected) {
    tone = 'success';
  }

  const badges: Array<{ label: string; tone?: PraxisRelationshipGraphTone }> = [];
  if (isSelected) {
    badges.push({ label: isPtBr ? 'Regra atual' : 'Current rule', tone: 'primary' });
  }
  badges.push({ label: policyLabel, tone: policyTone(policy) });
  if (trace) {
    badges.push({
      label: trace.divergent ? `${trace.activeOutcome} → ${trace.candidateOutcome}` : trace.candidateOutcome,
      tone: trace.divergent ? 'warning' : trace.candidateOutcome === 'DENY' ? 'danger' : 'success'
    });
  }

  return {
    id: `rule:${item.key}`,
    type: 'rule',
    shape: 'card',
    groupId: `stage:${stageId}`,
    label: truncateLabel(input.displayNodeTitle(item)),
    subtitle: input.viewDepth === 'technical' ? `${item.code} · ${policyLabel}` : policyLabel,
    icon: policyIcon(policy),
    tone,
    badges,
    attributes: { decisionKey: item.key, stageId },
    raw: { decisionKey: item.key, stageId }
  };
}

function buildBucketNode(
  bucket: AutonomyBucketKey,
  count: number,
  hasExcludedFeatured: boolean,
  lane: DagStageLane,
  isPtBr: boolean
): PraxisRelationshipGraphNode {
  const prefix = hasExcludedFeatured ? (isPtBr ? 'Outras ' : 'Other ') : '';
  const unitNoun =
    count === 1
      ? isPtBr ? 'regra' : 'rule'
      : isPtBr ? 'regras' : 'rules';

  let adjective: string;
  let icon: string;
  let tone: PraxisRelationshipGraphTone;

  if (bucket === 'fixed') {
    adjective = count === 1 ? (isPtBr ? 'fixa' : 'fixed') : isPtBr ? 'fixas' : 'fixed';
    icon = 'lock';
    tone = 'neutral';
  } else if (bucket === 'parameterizable') {
    adjective = count === 1 ? (isPtBr ? 'parametrizável' : 'parameterizable') : isPtBr ? 'parametrizáveis' : 'parameterizable';
    icon = 'tune';
    tone = 'info';
  } else {
    adjective = count === 1 ? (isPtBr ? 'customizável' : 'customizable') : isPtBr ? 'customizáveis' : 'customizable';
    icon = 'edit';
    tone = 'success';
  }

  const label = isPtBr
    ? `${prefix}${count} ${unitNoun} ${adjective}`
    : `${prefix}${count} ${adjective} ${unitNoun}`;

  return {
    id: `bucket:${lane.id}:${bucket}`,
    type: 'bucket',
    shape: 'card',
    groupId: `stage:${lane.id}`,
    label,
    subtitle: isPtBr ? `Clique para ver etapa 0${lane.index}` : `Click to view stage 0${lane.index}`,
    icon,
    tone,
    attributes: { jumpStageId: lane.id },
    raw: { jumpStageId: lane.id }
  };
}

function connectFrontiers(
  fromIds: readonly string[],
  toIds: readonly string[],
  edges: PraxisRelationshipGraphEdge[],
  edgeCounter: { value: number },
  relation: string,
  evidence: 'observed' | 'contextual' | 'inferred',
  tone?: PraxisRelationshipGraphTone
): void {
  if (fromIds.length === 0 || toIds.length === 0) {
    return;
  }

  // When both sides fan out, anchor from the lead node to keep routing crisp.
  const effectiveFrom = fromIds.length > 1 && toIds.length > 1 ? [fromIds[0]!] : fromIds;
  for (const source of effectiveFrom) {
    for (const target of toIds) {
      edges.push({
        id: `edge:${++edgeCounter.value}`,
        source,
        target,
        relation,
        directed: true,
        evidence,
        ...(tone ? { tone } : {})
      });
    }
  }
}

function flushEmptyBypass(
  emptyRun: DagStageLane[],
  frontierIds: readonly string[],
  nodes: PraxisRelationshipGraphNode[],
  edges: PraxisRelationshipGraphEdge[],
  edgeCounter: { value: number },
  isPtBr: boolean
): string[] {
  if (emptyRun.length === 0) {
    return [...frontierIds];
  }
  const first = emptyRun[0]!;
  const last = emptyRun[emptyRun.length - 1]!;
  const stageRange = first.index === last.index ? `0${first.index}` : `0${first.index}–0${last.index}`;
  const bypassId = `node:bypass:${first.index}-${last.index}`;

  nodes.push({
    id: bypassId,
    type: 'bypass',
    shape: 'pill',
    icon: 'fast_forward',
    tone: 'neutral',
    label: isPtBr
      ? `${emptyRun.length === 1 ? 'Etapa' : 'Etapas'} ${stageRange} · Passagem direta`
      : `${emptyRun.length === 1 ? 'Stage' : 'Stages'} ${stageRange} · Pass-through`,
    subtitle: isPtBr ? 'Sem regras cadastradas' : 'No rules registered',
    attributes: { jumpStageId: first.id },
    raw: { jumpStageId: first.id }
  });

  connectFrontiers(
    frontierIds,
    [bypassId],
    edges,
    edgeCounter,
    isPtBr ? 'Sem regras' : 'No rules',
    'inferred'
  );
  emptyRun.length = 0;
  return [bypassId];
}

function buildTraceVerdict(
  traceOverview: DagNodeTraceSummary | null,
  isPtBr: boolean
): PraxisRelationshipGraphVerdict | undefined {
  if (!traceOverview) {
    return undefined;
  }
  const scenariosText = isPtBr
    ? `${traceOverview.scenarioCount} cenário(s) simulados`
    : `${traceOverview.scenarioCount} simulated scenario(s)`;

  if (traceOverview.divergent) {
    return {
      tone: 'warning',
      title: isPtBr ? 'Divergência entre rascunho e versão ativa' : 'Draft diverges from active version',
      summary: isPtBr
        ? `${scenariosText} · Ativo: ${traceOverview.activeOutcome} → Candidato: ${traceOverview.candidateOutcome} (${traceOverview.divergentScenarioKeys.join(', ')})`
        : `${scenariosText} · Active: ${traceOverview.activeOutcome} → Candidate: ${traceOverview.candidateOutcome} (${traceOverview.divergentScenarioKeys.join(', ')})`
    };
  }

  return {
    tone: traceOverview.candidateOutcome === 'DENY' ? 'danger' : 'success',
    title: isPtBr ? 'Comportamento alinhado na simulação' : 'Simulation behavior aligned',
    summary: isPtBr
      ? `${scenariosText} · Resultado confirmado: ${traceOverview.candidateOutcome}`
      : `${scenariosText} · Confirmed outcome: ${traceOverview.candidateOutcome}`
  };
}

function buildFlowDataset(input: DecisionPlanGraphInput): {
  readonly dataset: PraxisRelationshipGraphDataset;
  readonly pathHighlight: PraxisRelationshipGraphPathHighlight | null;
} {
  const isPtBr = input.locale === 'pt-BR';
  const nodes: PraxisRelationshipGraphNode[] = [];
  const edges: PraxisRelationshipGraphEdge[] = [];
  const groups: PraxisRelationshipGraphGroup[] = [];
  const edgeCounter = { value: 0 };

  const entryId = 'node:entry';
  nodes.push({
    id: entryId,
    type: 'entry',
    shape: 'pill',
    icon: 'play_circle',
    tone: 'neutral',
    label: isPtBr ? 'Entrada da operação' : 'Operation entry',
    subtitle: input.selectedDecision?.operationKeys?.[0] ?? (isPtBr ? 'Início' : 'Start')
  });

  let frontierIds: string[] = [entryId];
  let frontierStageId: DecisionStageId | null = null;
  const emptyRun: DagStageLane[] = [];

  for (const lane of input.lanes) {
    if (lane.decisions.length === 0) {
      emptyRun.push(lane);
      continue;
    }

    const hadPrecedingBypass = emptyRun.length > 0;
    frontierIds = flushEmptyBypass(emptyRun, frontierIds, nodes, edges, edgeCounter, isPtBr);
    if (hadPrecedingBypass) {
      frontierStageId = null;
    }

    const stageTitle = isPtBr ? lane.titlePtBr : lane.titleEnUs;
    const countSuffix = lane.decisions.length > DENSE_STAGE_THRESHOLD ? ` (${lane.decisions.length})` : '';
    groups.push({
      id: `stage:${lane.id}`,
      label: `0${lane.index} · ${stageTitle}${countSuffix}`,
      tone: stageTone(lane.id),
      collapsed: false
    });

    const stageNodeIds: string[] = [];
    if (lane.decisions.length <= DENSE_STAGE_THRESHOLD) {
      for (const item of lane.decisions) {
        const node = buildRuleNode(item, lane.id, input);
        nodes.push(node);
        stageNodeIds.push(node.id);
      }
    } else {
      const featured: DecisionSummary[] = [];
      const seenKeys = new Set<string>();
      const selected = input.selectedDecision;
      if (selected && lane.decisions.some(item => item.key === selected.key)) {
        featured.push(selected);
        seenKeys.add(selected.key);
      }
      for (const item of lane.decisions) {
        if (featured.length >= 1 + MAX_FEATURED_PEER_NODES) {
          break;
        }
        if (!seenKeys.has(item.key) && input.nodeTrace(item)) {
          featured.push(item);
          seenKeys.add(item.key);
        }
      }
      for (const item of featured) {
        const node = buildRuleNode(item, lane.id, input);
        nodes.push(node);
        stageNodeIds.push(node.id);
      }

      const counts: Record<AutonomyBucketKey, number> = {
        fixed: 0,
        parameterizable: 0,
        customizable: 0
      };
      for (const item of lane.decisions) {
        if (seenKeys.has(item.key)) {
          continue;
        }
        counts[classifyAutonomyBucket(input.resolveOverridePolicy(item))] += 1;
      }

      for (const bucket of ['fixed', 'parameterizable', 'customizable'] as const) {
        if (counts[bucket] > 0) {
          const bucketNode = buildBucketNode(bucket, counts[bucket], seenKeys.size > 0, lane, isPtBr);
          nodes.push(bucketNode);
          stageNodeIds.push(bucketNode.id);
        }
      }
    }

    const fromEntry = frontierStageId === null && !hadPrecedingBypass;
    const fromGuard = frontierStageId === 'PROTECTED_GUARD';
    const edgeRelation = fromEntry
      ? isPtBr ? 'Inicia' : 'Starts'
      : fromGuard
        ? isPtBr ? 'Passa' : 'Passes'
        : isPtBr ? 'Segue' : 'Next';
    const edgeTone: PraxisRelationshipGraphTone | undefined = fromGuard ? 'success' : undefined;
    const edgeEvidence = 'observed';

    connectFrontiers(frontierIds, stageNodeIds, edges, edgeCounter, edgeRelation, edgeEvidence, edgeTone);

    if (lane.id === 'PROTECTED_GUARD' && stageNodeIds.length > 0) {
      const blockedId = 'node:blocked';
      nodes.push({
        id: blockedId,
        type: 'blocked',
        shape: 'diamond',
        icon: 'block',
        tone: 'danger',
        label: isPtBr ? 'Operação bloqueada' : 'Operation blocked',
        subtitle: isPtBr ? 'Bloqueio imediato' : 'Immediate block',
        attributes: { jumpStageId: 'PROTECTED_GUARD' },
        raw: { jumpStageId: 'PROTECTED_GUARD' }
      });
      const guardAnchor =
        stageNodeIds.find(id => id === `rule:${input.selectedDecision?.key ?? ''}`) ?? stageNodeIds[0]!;
      edges.push({
        id: `edge:${++edgeCounter.value}`,
        source: guardAnchor,
        target: blockedId,
        relation: isPtBr ? 'Bloqueia' : 'Blocks',
        directed: true,
        evidence: 'observed',
        tone: 'danger'
      });
    }

    frontierIds = stageNodeIds;
    frontierStageId = lane.id;
  }

  frontierIds = flushEmptyBypass(emptyRun, frontierIds, nodes, edges, edgeCounter, isPtBr);

  const approvedId = 'node:approved';
  nodes.push({
    id: approvedId,
    type: 'approved',
    shape: 'pill',
    icon: 'check_circle',
    tone: input.traceOverview?.candidateOutcome === 'DENY' ? 'warning' : 'success',
    label: isPtBr ? 'Decisão liberada' : 'Decision cleared',
    subtitle: isPtBr ? 'Etapas concluídas' : 'Stages complete'
  });

  connectFrontiers(
    frontierIds,
    [approvedId],
    edges,
    edgeCounter,
    isPtBr ? 'Libera' : 'Clears',
    'observed',
    input.traceOverview?.candidateOutcome === 'DENY' ? 'warning' : 'success'
  );

  const verdict = buildTraceVerdict(input.traceOverview, isPtBr);
  const pathHighlight =
    input.traceOverview && input.selectedDecision
      ? { focusNodeId: `rule:${input.selectedDecision.key}`, hops: 1 }
      : null;

  return {
    dataset: {
      nodes,
      edges,
      groups,
      ...(verdict ? { verdict } : {})
    },
    pathHighlight
  };
}

function buildImpactDataset(input: DecisionPlanGraphInput): {
  readonly dataset: PraxisRelationshipGraphDataset;
  readonly pathHighlight: PraxisRelationshipGraphPathHighlight | null;
} {
  const isPtBr = input.locale === 'pt-BR';
  const current = input.selectedDecision;
  if (!current) {
    return { dataset: { nodes: [], edges: [] }, pathHighlight: null };
  }

  const currentStageId =
    input.lanes.find(lane => lane.decisions.some(item => item.key === current.key))?.id ?? 'DOMAIN_DECISION';
  const centerNode = buildRuleNode(current, currentStageId, input);
  const nodes: PraxisRelationshipGraphNode[] = [{ ...centerNode, groupId: undefined }];
  const edges: PraxisRelationshipGraphEdge[] = [];
  const edgeCounter = { value: 0 };

  const partitioned = partitionDecisionFacts(current);
  for (const fact of partitioned.evaluatedFacts.slice(0, MAX_IMPACT_FACTS)) {
    const sensitivity = (fact.sensitivity ?? '').toUpperCase();
    const sensitive =
      sensitivity === 'PERSONAL' || sensitivity === 'SENSITIVE' || sensitivity === 'SECRET' || sensitivity === 'RESTRICTED';
    const factId = `fact:${fact.path}`;
    const displayLabel = formatFactDisplayLabel(fact, input.locale, input.viewDepth, true);

    nodes.push({
      id: factId,
      type: 'fact',
      shape: 'pill',
      icon: sensitive ? 'privacy_tip' : 'dataset',
      tone: sensitive ? 'warning' : 'info',
      label: truncateLabel(displayLabel, 32),
      subtitle: input.viewDepth === 'technical' ? fact.path : undefined
    });

    edges.push({
      id: `edge:${++edgeCounter.value}`,
      source: factId,
      target: centerNode.id,
      relation: isPtBr ? 'Lê dado' : 'Reads',
      directed: true,
      evidence: 'observed',
      tone: sensitive ? 'warning' : 'info'
    });
  }

  const neighborGroups = input.conceptNeighborGroups.slice(0, MAX_IMPACT_CONCEPTS);
  if (neighborGroups.length > 0) {
    const emittedNeighborKeys = new Set<string>();
    for (const group of neighborGroups) {
      const conceptId = `concept:${group.root}`;
      const conceptLabel =
        input.viewDepth === 'technical' ? group.root : humanizeTechnicalSlug(group.root, undefined, input.locale);

      nodes.push({
        id: conceptId,
        type: 'concept',
        shape: 'pill',
        icon: 'hub',
        tone: 'violet',
        label: truncateLabel(conceptLabel, 28),
        attributes: { conceptRoot: group.root },
        raw: { conceptRoot: group.root }
      });

      edges.push({
        id: `edge:${++edgeCounter.value}`,
        source: centerNode.id,
        target: conceptId,
        relation: isPtBr ? 'Conceito' : 'Concept',
        directed: true,
        evidence: 'observed',
        tone: 'violet'
      });

      for (const neighbor of group.neighborDecisions.slice(0, MAX_NEIGHBORS_PER_CONCEPT)) {
        if (neighbor.key === current.key || emittedNeighborKeys.has(neighbor.key)) {
          continue;
        }
        emittedNeighborKeys.add(neighbor.key);
        const neighborNode = buildRuleNode(neighbor, currentStageId, input);
        nodes.push({ ...neighborNode, groupId: undefined });
        edges.push({
          id: `edge:${++edgeCounter.value}`,
          source: conceptId,
          target: neighborNode.id,
          relation: '1-hop',
          directed: true,
          evidence: 'inferred',
          tone: 'violet'
        });
      }
    }
  } else {
    const peers = input.lanes
      .flatMap(lane => lane.decisions.map(item => ({ lane, item })))
      .filter(({ item }) => item.key !== current.key)
      .slice(0, MAX_IMPACT_FALLBACK_PEERS);

    for (const { lane, item } of peers) {
      const peerNode = buildRuleNode(item, lane.id, input);
      nodes.push({ ...peerNode, groupId: undefined });
      edges.push({
        id: `edge:${++edgeCounter.value}`,
        source: centerNode.id,
        target: peerNode.id,
        relation: lane.id === currentStageId ? (isPtBr ? 'mesma etapa' : 'same stage') : isPtBr ? 'próxima etapa' : 'next stage',
        directed: true,
        evidence: 'contextual'
      });
    }
  }

  const verdict = buildTraceVerdict(input.traceOverview, isPtBr);
  return {
    dataset: {
      nodes,
      edges,
      ...(verdict ? { verdict } : {})
    },
    pathHighlight: { focusNodeId: centerNode.id, hops: 2 }
  };
}

export function buildDecisionPlanGraph(input: DecisionPlanGraphInput): BuiltDecisionPlanGraph {
  const isPtBr = input.locale === 'pt-BR';
  const isImpact = input.graphLens === 'impact' && input.selectedDecision !== null;
  const built = isImpact ? buildImpactDataset(input) : buildFlowDataset(input);

  const config: PraxisRelationshipGraphConfig = {
    id: `decision-plan-${input.graphLens}-${input.selectedDecision?.key ?? 'default'}`,
    layout: {
      algorithm: isImpact ? 'ego-radial' : 'layered-dag',
      orientation: 'LR',
      ...(isImpact && input.selectedDecision ? { anchorNodeId: `rule:${input.selectedDecision.key}`, maxDepth: 2 } : {}),
      nodeShape: 'card',
      defaultViewMode: 'graph',
      showToolbar: false,
      showFilters: false,
      showLegend: false,
      showTableToggle: false,
      showInspector: false,
      showZoomControls: true,
      showCanvasGrid: true
    },
    appearance: {
      skin: 'flat',
      tokens: buildAppearanceTokens()
    },
    taxonomy: buildTaxonomy(isPtBr)
  };

  return {
    config,
    dataset: built.dataset,
    pathHighlight: built.pathHighlight
  };
}
