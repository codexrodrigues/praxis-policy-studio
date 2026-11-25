import '@angular/compiler';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EXPLORER_WIDTH_STORAGE_KEY,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  StudioShellStateService
} from './studio-shell-state.service';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('StudioShellStateService', () => {
  beforeEach(() => {
    localStorage.removeItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    localStorage.removeItem(EXPLORER_WIDTH_STORAGE_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    localStorage.removeItem(EXPLORER_WIDTH_STORAGE_KEY);
    TestBed.resetTestingModule();
  });

  it('toggles view depth, opens inspector tabs, and bridges logout and theme handlers', () => {
    const shell = TestBed.inject(StudioShellStateService);

    expect(shell.activeWorkspaceTrack()).toBe('business');
    expect(shell.viewDepth()).toBe('business');
    expect(shell.toggleViewDepth()).toBe('technical');
    expect(shell.viewDepth()).toBe('technical');

    shell.setWorkspaceTrack('authorization');
    expect(shell.activeWorkspaceTrack()).toBe('authorization');

    shell.toggleInspector();
    expect(shell.inspectorOpen()).toBe(false);
    shell.openInspectorTab('ai');
    expect(shell.inspectorOpen()).toBe(true);
    expect(shell.inspectorTab()).toBe('ai');

    const active = signal(true);
    const signingOut = signal(false);
    const dark = signal(false);
    const onLogout = vi.fn();
    const onToggleTheme = vi.fn(() => dark.update(value => !value));

    shell.registerSessionReaders(() => active(), () => signingOut());
    shell.registerDarkThemeReader(() => dark());
    shell.registerLogoutHandler(onLogout);
    shell.registerThemeToggleHandler(onToggleTheme);

    expect(shell.sessionActive()).toBe(true);
    expect(shell.isDarkTheme()).toBe(false);

    shell.toggleTheme();
    expect(onToggleTheme).toHaveBeenCalledOnce();
    expect(shell.isDarkTheme()).toBe(true);

    shell.triggerLogout();
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('tracks contextual access bridge handoff and global command palette state', () => {
    const shell = TestBed.inject(StudioShellStateService);

    expect(shell.accessBridgeContext()).toBeNull();
    expect(shell.commandPaletteOpen()).toBe(false);

    shell.openAccessBridge({
      resourceKey: 'human-resources.attendance',
      serviceKey: 'attendance-service',
      domainLabel: 'Human Resources · Attendance',
      ruleTitle: 'Retroactive entry window',
      decisionKey: 'workforce.attendance.retroactive',
      sensitiveFactsCount: 2
    });

    expect(shell.activeWorkspaceTrack()).toBe('authorization');
    expect(shell.accessBridgeContext()?.resourceKey).toBe('human-resources.attendance');

    shell.clearAccessBridgeContext();
    expect(shell.accessBridgeContext()).toBeNull();

    shell.toggleCommandPalette();
    expect(shell.commandPaletteOpen()).toBe(true);
    shell.closeCommandPalette();
    expect(shell.commandPaletteOpen()).toBe(false);
    shell.openCommandPalette();
    expect(shell.commandPaletteOpen()).toBe(true);
  });

  it('tracks sidebar collapse, clamped explorer width, breadcrumbs, and review queue badge', () => {
    const shell = TestBed.inject(StudioShellStateService);
    const navCalls: string[] = [];
    shell.registerNavigator(route => navCalls.push(route));

    expect(shell.sidebarCollapsed()).toBe(false);
    shell.toggleSidebar();
    expect(shell.sidebarCollapsed()).toBe(true);

    expect(shell.explorerWidthPx()).toBe(296);
    shell.setExplorerWidth(120);
    expect(shell.explorerWidthPx()).toBe(256);
    shell.setExplorerWidth(999);
    expect(shell.explorerWidthPx()).toBe(440);
    shell.resetExplorerWidth();
    expect(shell.explorerWidthPx()).toBe(296);

    shell.setReviewQueueCount(7);
    expect(shell.reviewQueueCount()).toBe(7);

    shell.setBreadcrumbs([{ label: 'Catálogo', route: '/catalog' }, { label: 'Frequências' }]);
    expect(shell.breadcrumbs()).toHaveLength(2);

    shell.setWorkspaceTrack('authorization');
    expect(navCalls).toContain('/access');
    shell.setWorkspaceTrack('business');
    expect(navCalls).toContain('/catalog');
  });

  it('persists and restores sidebar collapse and clamped explorer width safely', () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, 'true');
    localStorage.setItem(EXPLORER_WIDTH_STORAGE_KEY, '600');

    const restored = TestBed.inject(StudioShellStateService);
    expect(restored.sidebarCollapsed()).toBe(true);
    expect(restored.explorerWidthPx()).toBe(440);

    restored.setSidebarCollapsed(false);
    restored.setExplorerWidth(310);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('false');
    expect(localStorage.getItem(EXPLORER_WIDTH_STORAGE_KEY)).toBe('310');
  });
});
