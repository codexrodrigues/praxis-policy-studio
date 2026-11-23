import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { type ActivatedRouteSnapshot, type RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { PolicyStudioI18n, type CopyKey } from './i18n';
import type { StudioNavItemId } from './studio-navigation';

const TITLE_KEY_BY_NAV_ITEM: Readonly<Record<StudioNavItemId, CopyKey>> = {
  overview: 'pageTitleOverview',
  catalog: 'pageTitleCatalog',
  reviews: 'pageTitleReviews',
  access: 'pageTitleAccess'
};

@Injectable({ providedIn: 'root' })
export class StudioTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(PolicyStudioI18n);
  private lastTitleKey: CopyKey = 'product';

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const resolvedKey = this.extractTitleKey(snapshot.root) ?? this.lastTitleKey;
    this.lastTitleKey = resolvedKey;
    this.title.setTitle(this.i18n.text(resolvedKey));
  }

  syncForNavItem(navItem: StudioNavItemId): void {
    const nextKey = TITLE_KEY_BY_NAV_ITEM[navItem] ?? 'product';
    this.lastTitleKey = nextKey;
    this.title.setTitle(this.i18n.text(nextKey));
  }

  refreshCurrentTitle(): void {
    this.title.setTitle(this.i18n.text(this.lastTitleKey));
  }

  private extractTitleKey(snapshot: ActivatedRouteSnapshot): CopyKey | null {
    let deepest: ActivatedRouteSnapshot | null = snapshot;
    let candidate: CopyKey | null = null;
    while (deepest) {
      const raw = deepest.data?.['titleKey'];
      if (typeof raw === 'string' && raw.trim()) {
        candidate = raw as CopyKey;
      }
      deepest = deepest.firstChild;
    }
    return candidate;
  }
}
