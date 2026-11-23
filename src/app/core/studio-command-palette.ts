import type { DecisionSummary } from '../features/catalog/catalog.fixture';
import { buildCatalogPortfolioSummary } from './catalog-portfolio';
import { humanizeDecisionTitle } from './humanize-labels';
import type { SupportedLocale } from './runtime-config';
import type { StudioViewDepth } from './studio-shell-state.service';
import type { StudioIconName } from '../shared/studio-icon.component';

export type CommandPaletteActionId =
  | 'open-portfolio'
  | 'open-reviews'
  | 'toggle-depth'
  | 'open-access-privacy'
  | 'open-ai'
  | 'toggle-theme'
  | 'nav-understand'
  | 'nav-rule'
  | 'nav-test'
  | 'nav-operate'
  | 'nav-history';

export type CommandPaletteItem =
  | {
      readonly kind: 'action';
      readonly id: string;
      readonly title: string;
      readonly subtitle: string;
      readonly badge: string | null;
      readonly icon: StudioIconName;
      readonly actionId: CommandPaletteActionId;
    }
  | {
      readonly kind: 'scope';
      readonly id: string;
      readonly title: string;
      readonly subtitle: string;
      readonly badge: string;
      readonly icon: StudioIconName;
      readonly scopeKey: string;
    }
  | {
      readonly kind: 'decision';
      readonly id: string;
      readonly title: string;
      readonly subtitle: string;
      readonly badge: string;
      readonly icon: StudioIconName;
      readonly decision: DecisionSummary;
    };

export interface CommandPaletteLabels {
  readonly openPortfolioTitle: string;
  readonly openPortfolioSubtitle: string;
  readonly openReviewsTitle?: string;
  readonly openReviewsSubtitle?: string;
  readonly toggleDepthTitle: string;
  readonly toggleDepthSubtitle: string;
  readonly openAccessTitle: string;
  readonly openAccessSubtitle: string;
  readonly openAiTitle: string;
  readonly openAiSubtitle: string;
  readonly toggleThemeTitle: string;
  readonly navUnderstandTitle: string;
  readonly navRuleTitle: string;
  readonly navTestTitle: string;
  readonly navOperateTitle: string;
  readonly navHistoryTitle: string;
  readonly domainScopeSubtitle: string;
  readonly functionalityScopeSubtitle: string;
  readonly rulesCountSuffix: string;
  readonly ruleSingularSuffix: string;
}

export interface CommandPaletteSearchInput {
  readonly query: string;
  readonly decisions: readonly DecisionSummary[];
  readonly selected: DecisionSummary | null;
  readonly viewDepth: StudioViewDepth;
  readonly locale: SupportedLocale;
  readonly isRemoteMode: boolean;
  readonly hasWorkspace: boolean;
  readonly labels: CommandPaletteLabels;
}

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function scoreMatch(haystack: string, normalizedQuery: string): number {
  if (!normalizedQuery) return 1;
  const normalized = normalizeSearchText(haystack);
  if (!normalized) return 0;
  if (normalized === normalizedQuery) return 120;
  if (normalized.startsWith(normalizedQuery)) return 90;
  if (normalized.includes(normalizedQuery)) return 60;
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every(token => normalized.includes(token))) {
    return 45;
  }
  return 0;
}

export function buildCommandPaletteResults(
  input: CommandPaletteSearchInput
): readonly CommandPaletteItem[] {
  const normalizedQuery = normalizeSearchText(input.query);
  const items: CommandPaletteItem[] = [];
  const { labels } = input;

  const actions: Extract<CommandPaletteItem, { kind: 'action' }>[] = [];
  if (input.decisions.length > 1) {
    actions.push({
      kind: 'action',
      id: 'action:open-portfolio',
      title: labels.openPortfolioTitle,
      subtitle: labels.openPortfolioSubtitle,
      badge: null,
      icon: 'layout-grid',
      actionId: 'open-portfolio'
    });
  }
  if (labels.openReviewsTitle) {
    actions.push({
      kind: 'action',
      id: 'action:open-reviews',
      title: labels.openReviewsTitle,
      subtitle: labels.openReviewsSubtitle ?? '',
      badge: null,
      icon: 'inbox',
      actionId: 'open-reviews'
    });
  }
  actions.push({
    kind: 'action',
    id: 'action:toggle-depth',
    title: labels.toggleDepthTitle,
    subtitle: labels.toggleDepthSubtitle,
    badge: 'Shift+D',
    icon: 'sliders',
    actionId: 'toggle-depth'
  });
  actions.push({
    kind: 'action',
    id: 'action:open-access-privacy',
    title: labels.openAccessTitle,
    subtitle: labels.openAccessSubtitle,
    badge: 'OPA',
    icon: 'shield-check',
    actionId: 'open-access-privacy'
  });
  if (input.isRemoteMode) {
    actions.push({
      kind: 'action',
      id: 'action:open-ai',
      title: labels.openAiTitle,
      subtitle: labels.openAiSubtitle,
      badge: null,
      icon: 'sparkles',
      actionId: 'open-ai'
    });
  }
  actions.push({
    kind: 'action',
    id: 'action:toggle-theme',
    title: labels.toggleThemeTitle,
    subtitle: '',
    badge: null,
    icon: 'sun',
    actionId: 'toggle-theme'
  });
  if (input.selected) {
    actions.push(
      {
        kind: 'action',
        id: 'action:nav-understand',
        title: labels.navUnderstandTitle,
        subtitle: '',
        badge: '01',
        icon: 'book-open',
        actionId: 'nav-understand'
      },
      {
        kind: 'action',
        id: 'action:nav-rule',
        title: labels.navRuleTitle,
        subtitle: '',
        badge: '02',
        icon: 'file-edit',
        actionId: 'nav-rule'
      }
    );
    if (input.hasWorkspace) {
      actions.push({
        kind: 'action',
        id: 'action:nav-test',
        title: labels.navTestTitle,
        subtitle: '',
        badge: '03',
        icon: 'activity',
        actionId: 'nav-test'
      });
    }
    actions.push(
      {
        kind: 'action',
        id: 'action:nav-operate',
        title: labels.navOperateTitle,
        subtitle: '',
        badge: '04',
        icon: 'check-circle',
        actionId: 'nav-operate'
      },
      {
        kind: 'action',
        id: 'action:nav-history',
        title: labels.navHistoryTitle,
        subtitle: '',
        badge: '05',
        icon: 'clock',
        actionId: 'nav-history'
      }
    );
  }

  const matchedActions = !normalizedQuery
    ? actions.slice(0, 5)
    : actions
        .map(action => ({
          item: action,
          score: scoreMatch(`${action.title} ${action.subtitle}`, normalizedQuery)
        }))
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(entry => entry.item);
  items.push(...matchedActions);

  const portfolio = buildCatalogPortfolioSummary(
    input.decisions,
    input.locale,
    input.viewDepth
  );
  const scopeCandidates: { readonly item: Extract<CommandPaletteItem, { kind: 'scope' }>; readonly score: number }[] = [];
  const seenScopeKeys = new Set<string>();

  for (const domain of portfolio.domains) {
    if (!seenScopeKeys.has(domain.domainKey)) {
      seenScopeKeys.add(domain.domainKey);
      const countText = `${domain.totalCount} ${
        domain.totalCount === 1 ? labels.ruleSingularSuffix : labels.rulesCountSuffix
      }`;
      const functionalityLabels = domain.functionalities.map(func => func.label).join(' ');
      const score = Math.max(
        scoreMatch(`${domain.label} ${domain.domainKey}`, normalizedQuery),
        normalizedQuery ? scoreMatch(functionalityLabels, normalizedQuery) * 0.85 : 0
      );
      if (score > 0) {
        scopeCandidates.push({
          score: score + domain.totalCount * 0.01,
          item: {
            kind: 'scope',
            id: `scope:${domain.domainKey}`,
            title: domain.label,
            subtitle: labels.domainScopeSubtitle,
            badge: countText,
            icon: 'layers',
            scopeKey: domain.domainKey
          }
        });
      }
    }
    if (normalizedQuery) {
      for (const func of domain.functionalities) {
        if (seenScopeKeys.has(func.scopeKey)) continue;
        seenScopeKeys.add(func.scopeKey);
        const score = scoreMatch(`${func.label} ${func.scopeKey} ${domain.label}`, normalizedQuery);
        if (score > 0) {
          const countText = `${func.count} ${
            func.count === 1 ? labels.ruleSingularSuffix : labels.rulesCountSuffix
          }`;
          scopeCandidates.push({
            score,
            item: {
              kind: 'scope',
              id: `scope:${func.scopeKey}`,
              title: func.label,
              subtitle: `${labels.functionalityScopeSubtitle} · ${domain.label}`,
              badge: countText,
              icon: 'layers',
              scopeKey: func.scopeKey
            }
          });
        }
      }
    }
  }

  scopeCandidates.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  items.push(...scopeCandidates.slice(0, normalizedQuery ? 6 : 5).map(entry => entry.item));

  const decisionMatches: { readonly item: Extract<CommandPaletteItem, { kind: 'decision' }>; readonly score: number }[] = [];
  for (const decision of input.decisions) {
    const docTitle =
      decision.workspaceDocumentation?.title ??
      decision.documentation?.title ??
      decision.definitionDocumentation?.title;
    const displayTitle = humanizeDecisionTitle(
      decision.name,
      decision.code,
      docTitle,
      input.viewDepth,
      input.locale
    );
    const searchable = `${decision.code} ${decision.key} ${displayTitle} ${decision.name} ${decision.ruleSet} ${decision.domain}`;
    const score = normalizedQuery
      ? Math.max(
          scoreMatch(decision.code, normalizedQuery) * 1.4,
          scoreMatch(decision.key, normalizedQuery) * 1.2,
          scoreMatch(displayTitle, normalizedQuery),
          scoreMatch(searchable, normalizedQuery) * 0.7
        )
      : (decision.workspaceStatus === 'SUBMITTED' || decision.workspaceStatus === 'OPEN' ? 10 : 1);

    if (score > 0) {
      decisionMatches.push({
        score,
        item: {
          kind: 'decision',
          id: `decision:${decision.key}`,
          title: displayTitle,
          subtitle: decision.ruleSet || decision.domain,
          badge: decision.code,
          icon: decision.slotOverridePolicy === 'PARAMETERIZABLE' ? 'sliders' : 'circle-dot',
          decision
        }
      });
    }
  }

  decisionMatches.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  items.push(...decisionMatches.slice(0, normalizedQuery ? 12 : 6).map(entry => entry.item));

  return items;
}
