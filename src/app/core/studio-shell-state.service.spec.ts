import '@angular/compiler';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioShellStateService } from './studio-shell-state.service';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('StudioShellStateService', () => {
  afterEach(() => TestBed.resetTestingModule());

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
});
