import { Injectable, computed, signal } from '@angular/core';
import type { DecisionSummary } from '../features/catalog/catalog.fixture';
import type { DecisionWorkMode } from '../features/catalog/catalog-selection.store';
import type { StudioNavItemId } from './studio-navigation';

export type StudioWorkspaceTrack = 'business' | 'authorization';
export type StudioViewDepth = 'business' | 'technical';
export type StudioInspectorTab = 'properties' | 'ai' | 'technical';

export interface StudioBreadcrumbSegment {
  readonly label: string;
  readonly route?: string;
}

export interface StudioAccessBridgeContext {
  readonly resourceKey: string;
  readonly serviceKey: string | null;
  readonly domainLabel: string;
  readonly ruleTitle: string;
  readonly decisionKey: string;
  readonly sensitiveFactsCount: number;
}

export interface StudioNavigationOptions {
  readonly preserveAllQueryParams?: boolean;
}

export interface StudioCatalogRouteBridge {
  readonly selectDecision: (decision: DecisionSummary, mode?: DecisionWorkMode) => void;
  readonly applyScope: (scopeKey: string) => void;
  readonly openMode: (mode: DecisionWorkMode) => void;
  readonly hasUnsavedWork: () => boolean;
}

export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'praxis-rules-studio.shell.sidebar-collapsed';
export const EXPLORER_WIDTH_STORAGE_KEY = 'praxis-rules-studio.shell.explorer-width-px';
export const DEFAULT_EXPLORER_WIDTH_PX = 296;
export const MIN_EXPLORER_WIDTH_PX = 256;
export const MAX_EXPLORER_WIDTH_PX = 440;

function readStoredSidebarCollapsed(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeStoredSidebarCollapsed(collapsed: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, collapsed ? 'true' : 'false');
    }
  } catch {
    // Ignore storage errors under strict browser privacy modes.
  }
}

function readStoredExplorerWidth(): number {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_EXPLORER_WIDTH_PX;
    const raw = localStorage.getItem(EXPLORER_WIDTH_STORAGE_KEY);
    if (!raw) return DEFAULT_EXPLORER_WIDTH_PX;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_EXPLORER_WIDTH_PX;
    return Math.min(MAX_EXPLORER_WIDTH_PX, Math.max(MIN_EXPLORER_WIDTH_PX, Math.round(parsed)));
  } catch {
    return DEFAULT_EXPLORER_WIDTH_PX;
  }
}

function writeStoredExplorerWidth(widthPx: number): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(EXPLORER_WIDTH_STORAGE_KEY, String(widthPx));
    }
  } catch {
    // Ignore storage errors under strict browser privacy modes.
  }
}

@Injectable({ providedIn: 'root' })
export class StudioShellStateService {
  readonly activeWorkspaceTrack = signal<StudioWorkspaceTrack>('business');
  readonly activeNavItem = signal<StudioNavItemId>('catalog');
  readonly viewDepth = signal<StudioViewDepth>('business');
  readonly sidebarCollapsed = signal(readStoredSidebarCollapsed());
  readonly explorerWidthPx = signal(readStoredExplorerWidth());
  readonly inspectorOpen = signal(true);
  readonly inspectorTab = signal<StudioInspectorTab>('properties');
  readonly explorerOpen = signal(true);
  readonly accessBridgeContext = signal<StudioAccessBridgeContext | null>(null);
  readonly commandPaletteOpen = signal(false);
  readonly breadcrumbs = signal<readonly StudioBreadcrumbSegment[]>([]);
  readonly reviewQueueCount = signal(0);

  private readonly sessionActiveFallback = signal(false);
  private readonly signingOutFallback = signal(false);
  private readonly darkThemeFallback = signal(false);
  private readonly sessionActiveReader = signal<(() => boolean) | null>(null);
  private readonly signingOutReader = signal<(() => boolean) | null>(null);
  private readonly darkThemeReader = signal<(() => boolean) | null>(null);

  readonly sessionActive = computed(
    () => this.sessionActiveReader()?.() ?? this.rootHandlers?.sessionActive() ?? this.sessionActiveFallback()
  );
  readonly signingOut = computed(
    () => this.signingOutReader()?.() ?? this.rootHandlers?.signingOut() ?? this.signingOutFallback()
  );
  readonly isDarkTheme = computed(
    () => this.darkThemeReader()?.() ?? this.rootHandlers?.isDarkTheme() ?? this.darkThemeFallback()
  );

  private logoutCallback: (() => void) | null = null;
  private themeToggleCallback: (() => void) | null = null;
  private navigatorCallback: ((route: string, options?: StudioNavigationOptions) => void) | null = null;
  private catalogBridgeRef: StudioCatalogRouteBridge | null = null;
  private rootHandlers: {
    readonly logout: () => void;
    readonly toggleTheme: () => void;
    readonly sessionActive: () => boolean;
    readonly signingOut: () => boolean;
    readonly isDarkTheme: () => boolean;
  } | null = null;

  registerRootHandlers(handlers: {
    readonly logout: () => void;
    readonly toggleTheme: () => void;
    readonly sessionActive: () => boolean;
    readonly signingOut: () => boolean;
    readonly isDarkTheme: () => boolean;
  } | null): void {
    this.rootHandlers = handlers;
  }

  registerCatalogBridge(bridge: StudioCatalogRouteBridge | null): void {
    this.catalogBridgeRef = bridge;
  }

  catalogBridge(): StudioCatalogRouteBridge | null {
    return this.catalogBridgeRef;
  }

  registerNavigator(handler: ((route: string, options?: StudioNavigationOptions) => void) | null): void {
    this.navigatorCallback = handler;
  }

  navigateToRoute(route: string, options?: StudioNavigationOptions): void {
    if (options !== undefined) {
      this.navigatorCallback?.(route, options);
      return;
    }
    this.navigatorCallback?.(route);
  }

  setActiveNavItem(item: StudioNavItemId): void {
    this.activeNavItem.set(item);
    this.activeWorkspaceTrack.set(item === 'access' ? 'authorization' : 'business');
  }

  setWorkspaceTrack(track: StudioWorkspaceTrack): void {
    const previousTrack = this.activeWorkspaceTrack();
    this.activeWorkspaceTrack.set(track);
    if (track === 'authorization') {
      if (this.navigatorCallback) {
        this.navigatorCallback('/access');
      } else {
        this.activeNavItem.set('access');
      }
    } else if (previousTrack === 'authorization' || this.activeNavItem() === 'access') {
      if (this.navigatorCallback) {
        this.navigatorCallback('/catalog');
      } else {
        this.activeNavItem.set('catalog');
      }
    }
  }

  openAccessBridge(context: StudioAccessBridgeContext): void {
    this.accessBridgeContext.set(context);
    this.setWorkspaceTrack('authorization');
  }

  clearAccessBridgeContext(): void {
    this.accessBridgeContext.set(null);
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update(collapsed => {
      const next = !collapsed;
      writeStoredSidebarCollapsed(next);
      return next;
    });
  }

  setSidebarCollapsed(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
    writeStoredSidebarCollapsed(collapsed);
  }

  setExplorerWidth(px: number): void {
    if (!Number.isFinite(px)) return;
    const clamped = Math.min(MAX_EXPLORER_WIDTH_PX, Math.max(MIN_EXPLORER_WIDTH_PX, Math.round(px)));
    this.explorerWidthPx.set(clamped);
    writeStoredExplorerWidth(clamped);
  }

  resetExplorerWidth(): void {
    this.explorerWidthPx.set(DEFAULT_EXPLORER_WIDTH_PX);
    writeStoredExplorerWidth(DEFAULT_EXPLORER_WIDTH_PX);
  }

  setBreadcrumbs(segments: readonly StudioBreadcrumbSegment[]): void {
    this.breadcrumbs.set(segments);
  }

  setReviewQueueCount(count: number): void {
    this.reviewQueueCount.set(Math.max(0, Math.floor(count)));
  }

  openCommandPalette(): void {
    this.commandPaletteOpen.set(true);
  }

  closeCommandPalette(): void {
    this.commandPaletteOpen.set(false);
  }

  toggleCommandPalette(): void {
    this.commandPaletteOpen.update(open => !open);
  }

  setViewDepth(depth: StudioViewDepth): void {
    this.viewDepth.set(depth);
  }

  toggleViewDepth(): StudioViewDepth {
    const next: StudioViewDepth = this.viewDepth() === 'business' ? 'technical' : 'business';
    this.viewDepth.set(next);
    return next;
  }

  openInspectorTab(tab: StudioInspectorTab): void {
    this.inspectorOpen.set(true);
    this.inspectorTab.set(tab);
  }

  toggleInspector(): void {
    this.inspectorOpen.update(open => !open);
  }

  toggleExplorer(): void {
    this.explorerOpen.update(open => !open);
  }

  registerLogoutHandler(handler: (() => void) | null): void {
    this.logoutCallback = handler;
  }

  triggerLogout(): void {
    (this.logoutCallback ?? this.rootHandlers?.logout)?.();
  }

  registerSessionReaders(
    sessionActiveReader: (() => boolean) | null,
    signingOutReader: (() => boolean) | null
  ): void {
    this.sessionActiveReader.set(sessionActiveReader);
    this.signingOutReader.set(signingOutReader);
  }

  syncSessionState(active: boolean, signingOut: boolean): void {
    this.sessionActiveFallback.set(active);
    this.signingOutFallback.set(signingOut);
  }

  registerThemeToggleHandler(handler: (() => void) | null): void {
    this.themeToggleCallback = handler;
  }

  registerDarkThemeReader(darkThemeReader: (() => boolean) | null): void {
    this.darkThemeReader.set(darkThemeReader);
  }

  syncDarkTheme(isDark: boolean): void {
    this.darkThemeFallback.set(isDark);
  }

  toggleTheme(): void {
    (this.themeToggleCallback ?? this.rootHandlers?.toggleTheme)?.();
  }
}
