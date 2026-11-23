import type { CopyKey } from './i18n';
import type { StudioWorkspaceTrack } from './studio-shell-state.service';
import type { StudioIconName } from '../shared/studio-icon.component';

export type StudioNavGroupId = 'decisions' | 'access';

export type StudioNavItemId = 'overview' | 'catalog' | 'reviews' | 'access';

export type StudioNavBadgeKind = 'reviewQueue';

export interface StudioNavGroup {
  readonly id: StudioNavGroupId;
  readonly labelKey: CopyKey;
}

export interface StudioNavItem {
  readonly id: StudioNavItemId;
  readonly group: StudioNavGroupId;
  readonly route: string;
  readonly icon: StudioIconName;
  readonly labelKey: CopyKey;
  readonly testId: string;
  readonly track: StudioWorkspaceTrack;
  readonly badgeKind?: StudioNavBadgeKind;
  readonly requiredCapability?: string;
  readonly supportsExplorer: boolean;
  readonly supportsInspector: boolean;
}

export interface VisibleStudioNavItem extends StudioNavItem {
  readonly badgeCount: number | null;
}

export interface VisibleStudioNavGroup {
  readonly id: StudioNavGroupId;
  readonly labelKey: CopyKey;
  readonly items: readonly VisibleStudioNavItem[];
}

export const STUDIO_NAV_GROUPS: readonly StudioNavGroup[] = [
  { id: 'decisions', labelKey: 'navGroupDecisions' },
  { id: 'access', labelKey: 'navGroupAccess' }
];

export const STUDIO_NAV_ITEMS: readonly StudioNavItem[] = [
  {
    id: 'overview',
    group: 'decisions',
    route: '/overview',
    icon: 'layout-grid',
    labelKey: 'navItemOverview',
    testId: 'nav-module-overview',
    track: 'business',
    supportsExplorer: false,
    supportsInspector: false
  },
  {
    id: 'catalog',
    group: 'decisions',
    route: '/catalog',
    icon: 'layers',
    labelKey: 'navItemCatalog',
    testId: 'workspace-track-business',
    track: 'business',
    supportsExplorer: true,
    supportsInspector: true
  },
  {
    id: 'reviews',
    group: 'decisions',
    route: '/reviews',
    icon: 'inbox',
    labelKey: 'navItemReviews',
    testId: 'nav-module-reviews',
    track: 'business',
    badgeKind: 'reviewQueue',
    supportsExplorer: false,
    supportsInspector: false
  },
  {
    id: 'access',
    group: 'access',
    route: '/access',
    icon: 'shield-check',
    labelKey: 'navItemAccess',
    testId: 'workspace-track-authorization',
    track: 'authorization',
    supportsExplorer: false,
    supportsInspector: false
  }
];

export const PRESERVED_ENVIRONMENT_QUERY_PARAMS = [
  'tenantId',
  'organizationId',
  'environment',
  'apiBaseUrl'
] as const;

export function extractPreservedEnvironmentQueryParams(
  source: string | URLSearchParams | Readonly<Record<string, string | null | undefined>> | null | undefined
): Record<string, string> {
  if (!source) return {};
  const preserved: Record<string, string> = {};
  if (typeof source === 'string' || source instanceof URLSearchParams) {
    const params = typeof source === 'string'
      ? new URLSearchParams(source.startsWith('?') ? source : `?${source.split('?')[1] ?? source}`)
      : source;
    for (const key of PRESERVED_ENVIRONMENT_QUERY_PARAMS) {
      const value = params.get(key)?.trim();
      if (value) {
        preserved[key] = value;
      }
    }
    return preserved;
  }
  for (const key of PRESERVED_ENVIRONMENT_QUERY_PARAMS) {
    const value = source[key]?.trim();
    if (value) {
      preserved[key] = value;
    }
  }
  return preserved;
}

export function resolveNavItemFromUrl(url: string): StudioNavItemId {
  const path = url.split('?')[0]?.split('#')[0]?.trim().toLowerCase() ?? '';
  if (path.startsWith('/overview')) return 'overview';
  if (path.startsWith('/reviews')) return 'reviews';
  if (path.startsWith('/access')) return 'access';
  return 'catalog';
}

export function findNavItemById(id: StudioNavItemId): StudioNavItem {
  return STUDIO_NAV_ITEMS.find(item => item.id === id) ?? STUDIO_NAV_ITEMS[1]!;
}

export function buildVisibleNavGroups(
  items: readonly StudioNavItem[],
  isAllowed: (item: StudioNavItem) => boolean,
  badges: Partial<Readonly<Record<StudioNavBadgeKind, number>>> = {}
): readonly VisibleStudioNavGroup[] {
  return STUDIO_NAV_GROUPS
    .map(group => {
      const visibleItems: VisibleStudioNavItem[] = items
        .filter(item => item.group === group.id && isAllowed(item))
        .map(item => {
          const rawBadge = item.badgeKind ? badges[item.badgeKind] : undefined;
          const badgeCount = typeof rawBadge === 'number' && rawBadge > 0 ? rawBadge : null;
          return { ...item, badgeCount };
        });
      return {
        ...group,
        items: visibleItems
      };
    })
    .filter(group => group.items.length > 0);
}
