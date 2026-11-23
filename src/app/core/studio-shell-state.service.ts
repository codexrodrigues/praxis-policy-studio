import { Injectable, computed, signal } from '@angular/core';

export type StudioWorkspaceTrack = 'business' | 'authorization';
export type StudioViewDepth = 'business' | 'technical';
export type StudioInspectorTab = 'properties' | 'ai' | 'technical';

export interface StudioAccessBridgeContext {
  readonly resourceKey: string;
  readonly serviceKey: string | null;
  readonly domainLabel: string;
  readonly ruleTitle: string;
  readonly decisionKey: string;
  readonly sensitiveFactsCount: number;
}

@Injectable({ providedIn: 'root' })
export class StudioShellStateService {
  readonly activeWorkspaceTrack = signal<StudioWorkspaceTrack>('business');
  readonly viewDepth = signal<StudioViewDepth>('business');
  readonly inspectorOpen = signal(true);
  readonly inspectorTab = signal<StudioInspectorTab>('properties');
  readonly explorerOpen = signal(true);
  readonly accessBridgeContext = signal<StudioAccessBridgeContext | null>(null);
  readonly commandPaletteOpen = signal(false);

  private readonly sessionActiveFallback = signal(false);
  private readonly signingOutFallback = signal(false);
  private readonly darkThemeFallback = signal(false);
  private readonly sessionActiveReader = signal<(() => boolean) | null>(null);
  private readonly signingOutReader = signal<(() => boolean) | null>(null);
  private readonly darkThemeReader = signal<(() => boolean) | null>(null);

  readonly sessionActive = computed(
    () => this.sessionActiveReader()?.() ?? this.sessionActiveFallback()
  );
  readonly signingOut = computed(
    () => this.signingOutReader()?.() ?? this.signingOutFallback()
  );
  readonly isDarkTheme = computed(
    () => this.darkThemeReader()?.() ?? this.darkThemeFallback()
  );

  private logoutCallback: (() => void) | null = null;
  private themeToggleCallback: (() => void) | null = null;

  setWorkspaceTrack(track: StudioWorkspaceTrack): void {
    this.activeWorkspaceTrack.set(track);
  }

  openAccessBridge(context: StudioAccessBridgeContext): void {
    this.accessBridgeContext.set(context);
    this.activeWorkspaceTrack.set('authorization');
  }

  clearAccessBridgeContext(): void {
    this.accessBridgeContext.set(null);
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
    this.logoutCallback?.();
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
    this.themeToggleCallback?.();
  }
}
