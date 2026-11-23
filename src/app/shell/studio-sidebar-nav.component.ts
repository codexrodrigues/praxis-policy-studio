import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { PolicyStudioI18n } from '../core/i18n';
import type {
  StudioNavItemId,
  VisibleStudioNavGroup,
  VisibleStudioNavItem
} from '../core/studio-navigation';
import { StudioIconComponent } from '../shared/studio-icon.component';

@Component({
  selector: 'pax-studio-sidebar-nav',
  standalone: true,
  imports: [StudioIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside
      class="studio-sidebar"
      [class.collapsed]="collapsedSignal()"
      data-testid="studio-global-sidebar"
      [attr.aria-label]="i18n.text('primaryNavigation')">
      <div class="sidebar-groups">
        @for (group of groupsSignal(); track group.id) {
          <section class="nav-group" [attr.aria-label]="i18n.text(group.labelKey)">
            @if (!collapsedSignal()) {
              <p class="nav-group-label">{{ i18n.text(group.labelKey) }}</p>
            } @else {
              <span class="nav-group-divider" aria-hidden="true"></span>
            }
            <ul class="nav-list">
              @for (item of group.items; track item.id) {
                @let isActive = activeItemIdSignal() === item.id;
                <li>
                  <button
                    type="button"
                    class="nav-item"
                    [class.active]="isActive"
                    [attr.data-testid]="item.testId"
                    [attr.aria-current]="isActive ? 'page' : null"
                    [attr.aria-label]="accessibleLabel(item)"
                    [attr.title]="collapsedSignal() ? accessibleLabel(item) : null"
                    (click)="itemSelected.emit(item)">
                    <pax-icon class="nav-item-icon" [name]="item.icon" [size]="16" />
                    <span class="nav-item-label">{{ i18n.text(item.labelKey) }}</span>
                    @if (item.badgeCount !== null) {
                      <span
                        class="nav-item-badge studio-mono"
                        [attr.data-testid]="'nav-badge-' + item.id"
                        aria-hidden="true">
                        {{ item.badgeCount }}
                      </span>
                      @if (collapsedSignal()) {
                        <span
                          class="nav-item-badge-dot"
                          [attr.data-testid]="'nav-badge-dot-' + item.id"
                          aria-hidden="true"></span>
                      }
                    }
                  </button>
                </li>
              }
            </ul>
          </section>
        }
      </div>

      <footer class="sidebar-footer">
        <div
          class="mode-indicator"
          [class.is-remote]="isRemoteModeSignal()"
          [attr.title]="i18n.text(isRemoteModeSignal() ? 'governedConfig' : 'fixture')">
          <pax-icon name="shield-check" [size]="14" />
          @if (!collapsedSignal()) {
            <span>{{ i18n.text(isRemoteModeSignal() ? 'governedConfig' : 'fixture') }}</span>
          }
        </div>
        <button
          type="button"
          class="collapse-btn"
          data-testid="studio-sidebar-toggle"
          [attr.aria-expanded]="!collapsedSignal()"
          [attr.aria-label]="i18n.text(collapsedSignal() ? 'sidebarExpand' : 'sidebarCollapse')"
          [attr.title]="i18n.text(collapsedSignal() ? 'sidebarExpand' : 'sidebarCollapse')"
          (click)="toggleCollapseRequested.emit()">
          <pax-icon [name]="collapsedSignal() ? 'chevron-right' : 'panel-left'" [size]="16" />
        </button>
      </footer>
    </aside>
  `,
  styles: [`
    :host {
      display: block;
      min-width: 0;
    }

    .studio-sidebar {
      position: sticky;
      top: var(--pax-topbar-height);
      height: calc(100vh - var(--pax-topbar-height));
      width: var(--pax-global-nav-width);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: var(--pax-space-3);
      padding: var(--pax-space-3) var(--pax-space-2);
      background: var(--pax-color-surface-container-low);
      border-right: 1px solid var(--pax-color-outline-variant);
      box-sizing: border-box;
      transition: width 140ms ease;
    }

    .studio-sidebar.collapsed {
      width: var(--pax-global-nav-collapsed-width);
      padding-inline: 0.375rem;
    }

    .sidebar-groups {
      display: grid;
      gap: var(--pax-space-4);
      overflow-y: auto;
      overflow-x: hidden;
      min-height: 0;
      align-content: start;
    }

    .nav-group {
      display: grid;
      gap: var(--pax-space-1);
    }

    .nav-group-label {
      margin: 0;
      padding: var(--pax-space-1) var(--pax-space-2);
      color: var(--pax-color-on-surface-variant);
      font-size: 0.6875rem;
      line-height: 1.3;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .nav-group-divider {
      display: block;
      height: 1px;
      margin: var(--pax-space-1) var(--pax-space-2);
      background: var(--pax-color-outline-variant);
    }

    .nav-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.1875rem;
    }

    .nav-item {
      position: relative;
      width: 100%;
      min-height: 2.25rem;
      display: flex;
      align-items: center;
      gap: var(--pax-space-2);
      padding: 0.375rem var(--pax-space-3);
      border: 0;
      border-radius: var(--pax-radius-md);
      background: transparent;
      color: var(--pax-color-on-surface-variant);
      font: inherit;
      font-size: var(--pax-text-sm);
      line-height: var(--pax-lh-sm);
      font-weight: 600;
      text-align: left;
      cursor: pointer;
      min-width: 0;
    }

    .studio-sidebar.collapsed .nav-item {
      justify-content: center;
      padding-inline: 0;
    }

    .nav-item:hover {
      background: var(--pax-color-surface-container);
      color: var(--pax-color-on-surface);
    }

    .nav-item.active {
      background: var(--pax-color-primary-container);
      color: var(--pax-color-on-primary-container);
      font-weight: 700;
    }

    .nav-item.active::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0.375rem;
      bottom: 0.375rem;
      width: 3px;
      border-radius: 0 3px 3px 0;
      background: var(--pax-color-primary);
    }

    .nav-item:focus-visible,
    .collapse-btn:focus-visible {
      outline: 2px solid var(--pax-color-primary);
      outline-offset: 2px;
    }

    .nav-item-icon {
      flex-shrink: 0;
    }

    .nav-item-label {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .studio-sidebar.collapsed .nav-item-label,
    .studio-sidebar.collapsed .nav-item-badge {
      display: none;
    }

    .nav-item-badge-dot {
      position: absolute;
      top: 0.375rem;
      right: 0.5rem;
      width: 0.4375rem;
      height: 0.4375rem;
      border-radius: 50%;
      background: var(--pax-color-primary);
      border: 1.5px solid var(--pax-color-surface-container-low);
      pointer-events: none;
    }

    .nav-item-badge {
      flex-shrink: 0;
      padding: 0.0625rem 0.4375rem;
      border-radius: var(--pax-radius-pill);
      background: var(--pax-color-surface);
      color: var(--pax-color-primary);
      border: 1px solid var(--pax-color-outline-variant);
      font-size: 0.6875rem;
      font-weight: 700;
    }

    .sidebar-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--pax-space-2);
      padding-top: var(--pax-space-2);
      border-top: 1px solid var(--pax-color-outline-variant);
    }

    .studio-sidebar.collapsed .sidebar-footer {
      flex-direction: column;
      justify-content: center;
    }

    .mode-indicator {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      min-width: 0;
      padding: 0.25rem 0.5rem;
      border-radius: var(--pax-radius-pill);
      background: var(--pax-color-surface);
      border: 1px solid var(--pax-color-outline-variant);
      color: var(--pax-color-on-surface-variant);
      font-size: var(--pax-text-xs);
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mode-indicator.is-remote {
      color: var(--pax-color-primary);
      border-color: color-mix(in oklab, var(--pax-color-primary) 28%, var(--pax-color-outline-variant));
    }

    .collapse-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      flex-shrink: 0;
      border: 1px solid var(--pax-color-outline-variant);
      border-radius: var(--pax-radius-md);
      background: var(--pax-color-surface);
      color: var(--pax-color-on-surface-variant);
      cursor: pointer;
    }

    .collapse-btn:hover {
      color: var(--pax-color-on-surface);
      border-color: var(--pax-color-outline);
    }

    @media (max-width: 760px) {
      .studio-sidebar,
      .studio-sidebar.collapsed {
        position: static;
        width: 100%;
        height: auto;
        flex-direction: row;
        align-items: center;
        padding: var(--pax-space-2) var(--pax-space-3);
        border-right: 0;
        border-bottom: 1px solid var(--pax-color-outline-variant);
      }

      .sidebar-groups {
        display: flex;
        align-items: center;
        gap: var(--pax-space-2);
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: none;
        width: 100%;
      }

      .sidebar-groups::-webkit-scrollbar {
        display: none;
      }

      .nav-group {
        display: flex;
        align-items: center;
        gap: var(--pax-space-1);
        flex-shrink: 0;
      }

      .nav-group-label,
      .nav-group-divider,
      .sidebar-footer {
        display: none;
      }

      .nav-list {
        display: flex;
        align-items: center;
        gap: var(--pax-space-1);
      }

      .nav-item,
      .studio-sidebar.collapsed .nav-item {
        width: auto;
        justify-content: flex-start;
        padding: 0.3125rem var(--pax-space-3);
        min-height: 2rem;
      }

      .studio-sidebar.collapsed .nav-item-label,
      .studio-sidebar.collapsed .nav-item-badge {
        display: inline;
      }

      .nav-item.active::before {
        left: 0.375rem;
        right: 0.375rem;
        top: auto;
        bottom: 0;
        width: auto;
        height: 2px;
        border-radius: 2px 2px 0 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .studio-sidebar {
        transition: none;
      }
    }
  `]
})
export class StudioSidebarNavComponent {
  readonly i18n = inject(PolicyStudioI18n);

  readonly groupsSignal = signal<readonly VisibleStudioNavGroup[]>([]);
  readonly activeItemIdSignal = signal<StudioNavItemId>('catalog');
  readonly collapsedSignal = signal(false);
  readonly isRemoteModeSignal = signal(false);

  @Input()
  set groups(value: readonly VisibleStudioNavGroup[] | undefined) {
    this.groupsSignal.set(value ?? []);
  }

  @Input()
  set activeItemId(value: StudioNavItemId | undefined) {
    this.activeItemIdSignal.set(value ?? 'catalog');
  }

  @Input()
  set collapsed(value: boolean | undefined) {
    this.collapsedSignal.set(Boolean(value));
  }

  @Input()
  set isRemoteMode(value: boolean | undefined) {
    this.isRemoteModeSignal.set(Boolean(value));
  }

  @Output() readonly itemSelected = new EventEmitter<VisibleStudioNavItem>();
  @Output() readonly toggleCollapseRequested = new EventEmitter<void>();

  accessibleLabel(item: VisibleStudioNavItem): string {
    const label = this.i18n.text(item.labelKey);
    return item.badgeCount !== null
      ? this.i18n.format('navItemWithCount', { label, count: item.badgeCount })
      : label;
  }
}
