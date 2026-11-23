import { describe, expect, it } from 'vitest';
import {
  STUDIO_NAV_ITEMS,
  buildVisibleNavGroups,
  extractPreservedEnvironmentQueryParams,
  findNavItemById,
  resolveNavItemFromUrl
} from './studio-navigation';

describe('studio-navigation', () => {
  it('resolves active navigation module cleanly from URL paths and deep-links', () => {
    expect(resolveNavItemFromUrl('/catalog?resourceKey=workforce.attendance')).toBe('catalog');
    expect(resolveNavItemFromUrl('/overview')).toBe('overview');
    expect(resolveNavItemFromUrl('/reviews?bucket=submitted')).toBe('reviews');
    expect(resolveNavItemFromUrl('/access')).toBe('access');
    expect(resolveNavItemFromUrl('/')).toBe('catalog');
  });

  it('extracts only environment scope query params and strips stale deep-link params', () => {
    expect(
      extractPreservedEnvironmentQueryParams(
        '?resourceKey=workforce.attendance&ruleSetKey=abc&decisionKey=r1&tenantId=rio&organizationId=ALL&environment=stage&apiBaseUrl=https%3A%2F%2Fhost.example'
      )
    ).toEqual({
      tenantId: 'rio',
      organizationId: 'ALL',
      environment: 'stage',
      apiBaseUrl: 'https://host.example'
    });
    expect(extractPreservedEnvironmentQueryParams('?decisionKey=r1&tenantId=   ')).toEqual({});
  });

  it('builds grouped navigation items with optional review queue badge and server visibility checks', () => {
    const groups = buildVisibleNavGroups(
      STUDIO_NAV_ITEMS,
      item => item.id !== 'overview',
      { reviewQueue: 4 }
    );

    expect(groups.map(g => g.id)).toEqual(['decisions', 'access']);
    expect(groups[0]?.items.map(i => i.id)).toEqual(['catalog', 'reviews']);
    expect(groups[0]?.items[1]?.badgeCount).toBe(4);
    expect(groups[1]?.items[0]?.id).toBe('access');
    expect(findNavItemById('catalog').testId).toBe('workspace-track-business');
    expect(findNavItemById('access').testId).toBe('workspace-track-authorization');
  });
});
