import { NgTemplateOutlet } from '@angular/common';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { ChangeDetectionStrategy, Component, DestroyRef, ViewChild, computed, effect, inject, input, output, signal } from '@angular/core';
import type { DomainRuleDefinitionRequest } from '@praxisui/core';
import {
  buildCatalogPortfolioSummary,
  classifyDecisionWorkflowBucket,
  isAutonomyFilterReliable,
  isStageGroupingReliable,
  type ExplorerAutonomyFilter,
  type ExplorerGlobalLens
} from '../../core/catalog-portfolio';
import {
  humanizeDecisionTitle,
  humanizeRuleType,
  humanizeTechnicalSlug,
  looksLikeTechnicalSlug
} from '../../core/humanize-labels';
import { PolicyStudioI18n, type CopyKey } from '../../core/i18n';
import {
  DEFAULT_EXPLORER_WIDTH_PX,
  MAX_EXPLORER_WIDTH_PX,
  MIN_EXPLORER_WIDTH_PX,
  type StudioViewDepth
} from '../../core/studio-shell-state.service';
import { StudioIconComponent, type StudioIconName } from '../../shared/studio-icon.component';
import type { DecisionStageId, DecisionSummary } from './catalog.fixture';
import { DecisionCreateFormComponent } from './decision-create-form.component';

export interface ExplorerStageGroup {
  readonly stageKey: string;
  readonly labelKey: CopyKey;
  readonly items: readonly DecisionSummary[];
}

export interface ExplorerGlobalGroup {
  readonly groupKey: string;
  readonly label: string;
  readonly scopeKey: string | null;
  readonly items: readonly DecisionSummary[];
}

export interface ExplorerQuickScopeDomain {
  readonly domainKey: string;
  readonly label: string;
  readonly count: number;
  readonly options: readonly { readonly scopeKey: string; readonly label: string; readonly count: number }[];
}

export type ExplorerVirtualRow =
  | { readonly kind: 'stage'; readonly key: string; readonly labelKey: CopyKey; readonly count: number }
  | { readonly kind: 'group'; readonly key: string; readonly label: string; readonly scopeKey: string | null; readonly count: number }
  | { readonly kind: 'decision'; readonly key: string; readonly decision: DecisionSummary };

const STAGE_ORDER: readonly { readonly id: DecisionStageId; readonly labelKey: CopyKey }[] = [
  { id: 'PROTECTED_GUARD', labelKey: 'stageGuard' },
  { id: 'DOMAIN_DECISION', labelKey: 'stageDomain' },
  { id: 'POST_DECISION', labelKey: 'stagePost' },
  { id: 'TRANSFORMATION_INTENT', labelKey: 'stageTransform' },
  { id: 'EFFECT_INTENT', labelKey: 'stageEffect' }
];

@Component({
  selector: 'pax-decision-explorer-rail',
  imports: [NgTemplateOutlet, ScrollingModule, StudioIconComponent, DecisionCreateFormComponent],
  templateUrl: './decision-explorer-rail.component.html',
  styleUrl: './decision-explorer-rail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DecisionExplorerRailComponent {
  readonly i18n = inject(PolicyStudioI18n);

  readonly decisions = input.required<readonly DecisionSummary[]>();
  readonly allCatalogDecisions = input<readonly DecisionSummary[]>([]);
  readonly totalCatalogCount = input(0);
  readonly selected = input<DecisionSummary | null>(null);
  readonly query = input('');
  readonly contextScopeFilter = input<string | null>(null);
  readonly activeRuleTypeFilter = input<string | null>(null);
  readonly globalLens = input<ExplorerGlobalLens>('domain');
  readonly loading = input(true);
  readonly loadError = input<string | null>(null);
  readonly authenticationRequired = input(false);
  readonly permissionLimited = input(false);
  readonly authenticating = input(false);
  readonly authenticationFailed = input(false);
  readonly sessionActive = input(false);
  readonly logoutFailed = input(false);
  readonly selectionOutsideFilter = input(false);
  readonly busy = input(false);
  readonly authoringBusy = input(false);
  readonly isRemoteMode = input(false);
  readonly viewDepth = input<StudioViewDepth>('business');
  readonly widthPx = input(DEFAULT_EXPLORER_WIDTH_PX);

  readonly queryChanged = output<string>();
  readonly clearQueryRequested = output<void>();
  readonly clearContextScopeRequested = output<void>();
  readonly clearRuleTypeRequested = output<void>();
  readonly scopeSelected = output<string>();
  readonly globalLensChanged = output<ExplorerGlobalLens>();
  readonly collapseRequested = output<void>();
  readonly widthChanged = output<number>();
  readonly resetWidthRequested = output<void>();
  readonly decisionSelected = output<DecisionSummary>();
  readonly loginRequested = output<{ readonly username: string; readonly password: string; readonly form: HTMLFormElement }>();
  readonly retryCatalogRequested = output<void>();
  readonly reauthenticateRequested = output<void>();
  readonly createRequested = output<DomainRuleDefinitionRequest>();
  readonly validationFailed = output<string>();

  private readonly destroyRef = inject(DestroyRef);
  private stopResizeDrag: (() => void) | null = null;

  @ViewChild(CdkVirtualScrollViewport) private virtualViewport?: CdkVirtualScrollViewport;

  readonly autonomyFilter = signal<ExplorerAutonomyFilter>('all');
  readonly filtersPanelOpen = signal(false);
  readonly minWidthPx = MIN_EXPLORER_WIDTH_PX;
  readonly maxWidthPx = MAX_EXPLORER_WIDTH_PX;

  readonly scopeSourceDecisions = computed(() => {
    const all = this.allCatalogDecisions();
    return all.length > 0 ? all : this.decisions();
  });

  readonly quickScopeDomains = computed<readonly ExplorerQuickScopeDomain[]>(() => {
    const source = this.scopeSourceDecisions();
    if (source.length <= 1) return [];
    const summary = buildCatalogPortfolioSummary(source, this.i18n.locale(), this.viewDepth());
    return summary.domains.map(domain => ({
      domainKey: domain.domainKey,
      label: domain.label,
      count: domain.totalCount,
      options: domain.functionalities.map(func => ({
        scopeKey: func.scopeKey,
        label: func.label,
        count: func.count
      }))
    }));
  });

  readonly hasMultipleQuickScopes = computed(() => {
    const domains = this.quickScopeDomains();
    if (domains.length > 1) return true;
    return (domains[0]?.options.length ?? 0) > 1;
  });

  readonly activeQuickScopeLabel = computed(() => {
    const scope = this.contextScopeFilter()?.trim();
    if (!scope) {
      return this.allScopesLabel();
    }
    for (const domain of this.quickScopeDomains()) {
      if (domain.domainKey === scope) {
        return `${domain.label} (${domain.count})`;
      }
      const match = domain.options.find(opt => opt.scopeKey === scope);
      if (match) {
        return `${match.label} (${match.count})`;
      }
    }
    return this.displayScopeFilter(scope);
  });

  readonly autonomyFilterAvailable = computed(() =>
    isAutonomyFilterReliable(this.decisions())
  );

  readonly effectiveAutonomyFilter = computed<ExplorerAutonomyFilter>(() =>
    this.autonomyFilterAvailable() ? this.autonomyFilter() : 'all'
  );

  readonly activeFiltersCount = computed(() => {
    let count = 0;
    if (this.effectiveAutonomyFilter() !== 'all') count += 1;
    if (!this.hasStageMetadata() && this.globalLens() !== 'domain') count += 1;
    return count;
  });

  readonly hasExpandableFilterControls = computed(() => {
    if (this.decisions().length <= 1) return false;
    if (this.autonomyFilterAvailable()) {
      const counts = this.autonomyCounts();
      return counts.param > 0 || counts.editable > 0 || counts.locked > 0 || counts.legal > 0;
    }
    return !this.hasStageMetadata();
  });

  readonly autonomyCounts = computed(() => {
    const list = this.decisions();
    let param = 0;
    let editable = 0;
    let locked = 0;
    let legal = 0;
    for (const item of list) {
      const tone = this.autonomyTone(item);
      if (tone === 'param') param += 1;
      else if (tone === 'editable') editable += 1;
      else if (tone === 'locked') locked += 1;
      if (this.hasLegalBasis(item)) legal += 1;
    }
    return { all: list.length, param, editable, locked, legal };
  });

  readonly filteredDecisions = computed<readonly DecisionSummary[]>(() => {
    const list = this.decisions();
    const filter = this.effectiveAutonomyFilter();
    if (filter === 'all') return list;
    return list.filter(item => {
      if (filter === 'legal') return this.hasLegalBasis(item);
      return this.autonomyTone(item) === filter;
    });
  });

  readonly hasStageMetadata = computed(() =>
    isStageGroupingReliable(this.filteredDecisions())
  );

  readonly stageGroups = computed<readonly ExplorerStageGroup[]>(() => {
    const list = this.filteredDecisions();
    if (!list.length || !this.hasStageMetadata()) return [];
    const groups: ExplorerStageGroup[] = [];
    for (const stage of STAGE_ORDER) {
      const items = list.filter(item => item.decisionStage === stage.id);
      if (items.length) {
        groups.push({ stageKey: stage.id, labelKey: stage.labelKey, items });
      }
    }
    const others = list.filter(item => !item.decisionStage);
    if (others.length) {
      groups.push({ stageKey: 'OTHER', labelKey: 'stageOther', items: others });
    }
    return groups;
  });

  readonly globalGroups = computed<readonly ExplorerGlobalGroup[]>(() => {
    const list = this.filteredDecisions();
    if (!list.length || this.hasStageMetadata()) return [];
    const lens = this.globalLens();
    const locale = this.i18n.locale();
    const depth = this.viewDepth();

    if (lens === 'workflow') {
      const buckets: {
        readonly id: 'SUBMITTED' | 'OPEN' | 'REJECTED' | 'APPROVED' | 'STABLE';
        readonly label: string;
      }[] = [
        { id: 'SUBMITTED', label: this.i18n.text('workspaceStateSubmitted') },
        { id: 'OPEN', label: this.i18n.text('workspaceStateOpen') },
        { id: 'REJECTED', label: this.i18n.text('workspaceStateRejected') },
        { id: 'APPROVED', label: this.i18n.text('workspaceStateApproved') },
        { id: 'STABLE', label: this.i18n.text('workflowBucketStable') }
      ];
      return buckets
        .map(bucket => ({
          groupKey: `workflow:${bucket.id}`,
          label: bucket.label,
          scopeKey: null,
          items: list.filter(item => classifyDecisionWorkflowBucket(item) === bucket.id)
        }))
        .filter(group => group.items.length > 0);
    }

    if (lens === 'type') {
      const byType = new Map<string, DecisionSummary[]>();
      for (const item of list) {
        const key = item.ruleType?.trim() || 'other';
        const bucket = byType.get(key) ?? [];
        bucket.push(item);
        byType.set(key, bucket);
      }
      return [...byType.entries()]
        .map(([ruleType, items]) => ({
          groupKey: `type:${ruleType}`,
          label: humanizeRuleType(ruleType, locale),
          scopeKey: null,
          items
        }))
        .sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
    }

    const distinctDomains = new Set(list.map(item => item.domain?.trim() || 'domain-decisions'));
    const groupByFunctionality = distinctDomains.size <= 1;
    const byScope = new Map<string, { rawLabel: string; items: DecisionSummary[] }>();
    for (const item of list) {
      const key = groupByFunctionality
        ? (item.ruleSetKey?.trim() || item.resourceKey?.trim() || item.domain?.trim() || 'catalog')
        : (item.domain?.trim() || 'domain-decisions');
      const rawLabel = groupByFunctionality
        ? (item.ruleSet?.trim() || item.resourceKey?.trim() || key)
        : key;
      const entry = byScope.get(key);
      if (entry) {
        entry.items.push(item);
      } else {
        byScope.set(key, { rawLabel, items: [item] });
      }
    }
    return [...byScope.entries()]
      .map(([scopeKey, entry]) => ({
        groupKey: `domain:${scopeKey}`,
        label:
          depth === 'technical' || !looksLikeTechnicalSlug(entry.rawLabel)
            ? entry.rawLabel
            : (humanizeTechnicalSlug(entry.rawLabel, 2, locale) || entry.rawLabel),
        scopeKey: groupByFunctionality || !this.contextScopeFilter() ? scopeKey : null,
        items: entry.items
      }))
      .sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
  });

  readonly useVirtualScroll = computed(() => this.filteredDecisions().length > 40);

  readonly virtualRows = computed<readonly ExplorerVirtualRow[]>(() => {
    if (!this.useVirtualScroll()) return [];
    const list = this.filteredDecisions();
    if (this.hasStageMetadata()) {
      const rows: ExplorerVirtualRow[] = [];
      for (const group of this.stageGroups()) {
        rows.push({
          kind: 'stage',
          key: `stage:${group.stageKey}`,
          labelKey: group.labelKey,
          count: group.items.length
        });
        for (const decision of group.items) {
          rows.push({ kind: 'decision', key: decision.key, decision });
        }
      }
      return rows;
    }
    const groups = this.globalGroups();
    if (!groups.length) {
      return list.map(decision => ({ kind: 'decision', key: decision.key, decision }));
    }
    const rows: ExplorerVirtualRow[] = [];
    for (const group of groups) {
      rows.push({
        kind: 'group',
        key: group.groupKey,
        label: group.label,
        scopeKey: group.scopeKey,
        count: group.items.length
      });
      for (const decision of group.items) {
        rows.push({ kind: 'decision', key: decision.key, decision });
      }
    }
    return rows;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.stopResizeDrag?.());
    effect(() => {
      this.contextScopeFilter();
      this.autonomyFilter.set('all');
    });
    effect(() => {
      const current = this.selected();
      const rows = this.virtualRows();
      if (!current || !rows.length || !this.virtualViewport) return;
      const index = rows.findIndex(row => row.kind === 'decision' && row.decision.key === current.key);
      if (index >= 0) {
        this.virtualViewport.scrollToIndex(index, 'auto');
      }
    });
  }

  toggleFiltersPanel(): void {
    this.filtersPanelOpen.update(open => !open);
  }

  selectAutonomyFilter(filter: ExplorerAutonomyFilter): void {
    this.autonomyFilter.set(filter);
  }

  onQuickScopeChanged(value: string): void {
    const normalized = value.trim();
    if (!normalized) {
      this.clearContextScopeRequested.emit();
      return;
    }
    this.scopeSelected.emit(normalized);
  }

  allScopesLabel(): string {
    const total = this.totalCatalogCount() || this.scopeSourceDecisions().length;
    return this.i18n.format('explorerAllScopes', { count: total });
  }

  activeAutonomyLabel(): string {
    switch (this.effectiveAutonomyFilter()) {
      case 'param':
        return this.i18n.text('overrideParameterizableShort');
      case 'editable':
        return this.i18n.text('overrideEditableShort');
      case 'locked':
        return this.i18n.text('overrideForbiddenShort');
      case 'legal':
        return this.i18n.text('explorerFilterLegal');
      default:
        return this.i18n.text('explorerFilterAll');
    }
  }

  startResize(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    this.stopResizeDrag?.();
    const handle = event.currentTarget as HTMLElement | null;
    try {
      handle?.setPointerCapture?.(event.pointerId);
    } catch {
      // Ignore synthetic events where pointerId is inactive.
    }
    const startX = event.clientX;
    const startWidth = this.widthPx();
    const docBody = typeof document !== 'undefined' ? document.body : null;
    const prevUserSelect = docBody?.style.userSelect ?? '';
    const prevCursor = docBody?.style.cursor ?? '';
    if (docBody) {
      docBody.style.userSelect = 'none';
      docBody.style.cursor = 'col-resize';
    }
    const onMove = (moveEvent: PointerEvent) => {
      this.widthChanged.emit(startWidth + (moveEvent.clientX - startX));
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
      if (docBody) {
        docBody.style.userSelect = prevUserSelect;
        docBody.style.cursor = prevCursor;
      }
      try {
        if (handle?.hasPointerCapture?.(event.pointerId)) {
          handle.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Ignore already-released pointer captures.
      }
      if (this.stopResizeDrag === cleanup) {
        this.stopResizeDrag = null;
      }
    };
    this.stopResizeDrag = cleanup;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
  }

  onResizeKeydown(event: KeyboardEvent): void {
    const step = 16;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.widthChanged.emit(this.widthPx() + step);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.widthChanged.emit(this.widthPx() - step);
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.resetWidthRequested.emit();
    }
  }

  displayRuleTypeFilter(ruleType: string): string {
    return humanizeRuleType(ruleType, this.i18n.locale());
  }

  private hasLegalBasis(decision: DecisionSummary): boolean {
    const doc =
      decision.workspaceDocumentation ??
      decision.documentation ??
      decision.definitionDocumentation;
    return (doc?.legalBasis?.length ?? 0) > 0;
  }

  trackVirtualRow(_index: number, row: ExplorerVirtualRow): string {
    return row.key;
  }

  autonomyLabel(decision: DecisionSummary): string | null {
    switch (decision.slotOverridePolicy) {
      case 'FORBIDDEN':
      case 'LOCKED':
        return this.i18n.text('overrideForbiddenShort');
      case 'PARAMETERIZABLE':
        return this.i18n.text('overrideParameterizableShort');
      case 'RESTRICT_ONLY':
      case 'EXTEND_ONLY':
      case 'REPLACEABLE':
        return this.i18n.text('overrideEditableShort');
      default:
        return null;
    }
  }

  autonomyTone(decision: DecisionSummary): 'locked' | 'param' | 'editable' | null {
    switch (decision.slotOverridePolicy) {
      case 'FORBIDDEN':
      case 'LOCKED':
        return 'locked';
      case 'PARAMETERIZABLE':
        return 'param';
      case 'RESTRICT_ONLY':
      case 'EXTEND_ONLY':
      case 'REPLACEABLE':
        return 'editable';
      default:
        return null;
    }
  }

  autonomyIcon(decision: DecisionSummary): StudioIconName {
    switch (decision.slotOverridePolicy) {
      case 'PARAMETERIZABLE':
        return 'sliders';
      case 'RESTRICT_ONLY':
      case 'EXTEND_ONLY':
      case 'REPLACEABLE':
        return 'pencil';
      case 'FORBIDDEN':
      case 'LOCKED':
        return 'lock';
      default:
        return 'circle-dot';
    }
  }

  autonomyTooltip(decision: DecisionSummary): string {
    return this.autonomyLabel(decision) ?? this.i18n.text('detailsLoadedOnSelection');
  }

  hasActiveWorkflowIndicator(decision: DecisionSummary): boolean {
    const status = decision.workspaceStatus?.toUpperCase();
    return status === 'OPEN' || status === 'SUBMITTED' || status === 'APPROVED' || status === 'REJECTED';
  }

  workflowIndicatorTone(decision: DecisionSummary): 'open' | 'review' | 'approved' | 'rejected' | null {
    switch (decision.workspaceStatus?.toUpperCase()) {
      case 'OPEN':
        return 'open';
      case 'SUBMITTED':
        return 'review';
      case 'APPROVED':
        return 'approved';
      case 'REJECTED':
        return 'rejected';
      default:
        return null;
    }
  }

  workflowIndicatorTitle(decision: DecisionSummary): string | null {
    switch (decision.workspaceStatus?.toUpperCase()) {
      case 'OPEN':
        return this.i18n.text('workspaceStateOpen');
      case 'SUBMITTED':
        return this.i18n.text('workspaceStateSubmitted');
      case 'APPROVED':
        return this.i18n.text('workspaceStateApproved');
      case 'REJECTED':
        return this.i18n.text('workspaceStateRejected');
      default:
        return null;
    }
  }

  displayDomainEyebrow(): string {
    const domain = this.selected()?.domain?.trim() ?? '';
    if (!domain) return this.i18n.text('product');
    if (this.viewDepth() === 'technical' || !looksLikeTechnicalSlug(domain)) return domain;
    return humanizeTechnicalSlug(domain, 2, this.i18n.locale()) || domain;
  }

  displayScopeFilter(scopeFilter: string): string {
    if (this.viewDepth() === 'technical' || !looksLikeTechnicalSlug(scopeFilter)) return scopeFilter;
    return humanizeTechnicalSlug(scopeFilter, 2, this.i18n.locale()) || scopeFilter;
  }

  displayDecisionTitle(decision: DecisionSummary): string {
    const docTitle =
      decision.workspaceDocumentation?.title ??
      decision.documentation?.title ??
      decision.definitionDocumentation?.title;
    return humanizeDecisionTitle(
      decision.name,
      decision.code,
      docTitle,
      this.viewDepth(),
      this.i18n.locale()
    );
  }

  displayRuleSetSubtitle(decision: DecisionSummary): string | null {
    if (this.viewDepth() === 'business' && this.contextScopeFilter()) {
      return null;
    }
    const raw = decision.ruleSet?.trim() ?? '';
    if (!raw) return null;
    if (this.viewDepth() === 'business' && looksLikeTechnicalSlug(raw)) {
      return humanizeTechnicalSlug(raw, 2, this.i18n.locale());
    }
    return raw;
  }
}
