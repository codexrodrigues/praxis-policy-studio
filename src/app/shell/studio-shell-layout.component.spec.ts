import '@angular/compiler';
import { signal, ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideRouter } from '@angular/router';
import { PraxisThemeService } from '@praxisui/core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { GovernedHostScopeService } from '../core/governed-host-scope.service';
import { PolicyStudioI18n } from '../core/i18n';
import { RuntimeConfigService } from '../core/runtime-config.service';
import { StudioCatalogBootstrapService } from '../core/studio-catalog-bootstrap.service';
import { StudioShellStateService } from '../core/studio-shell-state.service';
import { StudioTitleStrategy } from '../core/studio-title.strategy';
import { CatalogSelectionStore } from '../features/catalog/catalog-selection.store';
import { StudioShellLayoutComponent } from './studio-shell-layout.component';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('StudioShellLayoutComponent', () => {
  let fixture: ComponentFixture<StudioShellLayoutComponent>;

  beforeAll(async () => {
    const fsModule = (
      globalThis as unknown as {
        process?: {
          getBuiltinModule?: (id: string) => {
            readFileSync: (file: URL, encoding: string) => string;
          };
        };
      }
    ).process?.getBuiltinModule?.('node:fs');

    await resolveComponentResources(async url => {
      if (url.endsWith('.scss')) {
        return '';
      }
      return fsModule?.readFileSync(new URL(url, import.meta.url), 'utf8') ?? '';
    });
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  function setup(): { shell: StudioShellStateService } {
    TestBed.configureTestingModule({
      imports: [StudioShellLayoutComponent],
      providers: [
        provideRouter([]),
        PolicyStudioI18n,
        StudioShellStateService,
        {
          provide: PraxisThemeService,
          useValue: { isDark: signal(false), toggleDark: vi.fn() }
        },
        {
          provide: RuntimeConfigService,
          useValue: {
            state: signal({
              kind: 'ready',
              config: {
                mode: 'fixture',
                configApiBaseUrl: null,
                locale: 'pt-BR',
                projectionPath: null,
                initialDecisionKey: null
              }
            }),
            mode: signal('fixture'),
            hostProfiles: signal([]),
            activeHostProfileId: signal(null),
            selectHostProfile: vi.fn(),
            load: vi.fn()
          }
        },
        {
          provide: StudioCatalogBootstrapService,
          useValue: { logout: vi.fn(), requestOpenInCatalog: vi.fn() }
        },
        {
          provide: GovernedHostScopeService,
          useValue: { scope: signal({ tenantId: null, organizationId: null, environment: null }) }
        },
        {
          provide: StudioTitleStrategy,
          useValue: { syncForNavItem: vi.fn() }
        },
        {
          provide: CatalogSelectionStore,
          useValue: {
            allDecisions: signal([]),
            decisions: signal([]),
            selected: signal(null),
            reviewQueueDecisions: signal([]),
            sessionActive: signal(false),
            signingOut: signal(false),
            activeRuleTypeFilter: signal(null),
            contextScopeFilter: signal(null),
            deepLinkConsumed: signal(false),
            pendingWorkMode: signal(null),
            activeMode: signal('understand'),
            narrowDetailOpen: signal(false)
          }
        }
      ]
    });

    fixture = TestBed.createComponent(StudioShellLayoutComponent);
    const shell = TestBed.inject(StudioShellStateService);
    shell.setSidebarCollapsed(false);
    shell.explorerOpen.set(true);
    shell.inspectorOpen.set(true);
    fixture.detectChanges();
    return { shell };
  }

  it('places the single global sidebar toggle in the topbar and renders explorer/inspector reopen buttons only when collapsed', () => {
    const { shell } = setup();

    const sidebarToggle = fixture.debugElement.query(By.css('[data-testid="studio-sidebar-toggle"]')).nativeElement as HTMLButtonElement;
    expect(sidebarToggle.getAttribute('aria-expanded')).toBe('true');

    // No duplicate topbar reopen buttons while Explorer and Inspector are open
    expect(fixture.debugElement.query(By.css('[data-testid="studio-toggle-explorer"]'))).toBeNull();
    expect(fixture.debugElement.query(By.css('[data-testid="studio-toggle-inspector"]'))).toBeNull();

    // Toggling global sidebar updates state cleanly
    sidebarToggle.click();
    fixture.detectChanges();
    expect(shell.sidebarCollapsed()).toBe(true);
    expect(sidebarToggle.getAttribute('aria-expanded')).toBe('false');

    // Collapsing Explorer reveals single reopen button in topbar which restores Explorer
    shell.toggleExplorer();
    fixture.detectChanges();
    const reopenExplorer = fixture.debugElement.query(By.css('[data-testid="studio-toggle-explorer"]')).nativeElement as HTMLButtonElement;
    reopenExplorer.click();
    fixture.detectChanges();
    expect(shell.explorerOpen()).toBe(true);
    expect(fixture.debugElement.query(By.css('[data-testid="studio-toggle-explorer"]'))).toBeNull();

    // Collapsing Inspector reveals reopen button in topbar which restores Inspector
    shell.toggleInspector();
    fixture.detectChanges();
    const reopenInspector = fixture.debugElement.query(By.css('[data-testid="studio-toggle-inspector"]')).nativeElement as HTMLButtonElement;
    reopenInspector.click();
    fixture.detectChanges();
    expect(shell.inspectorOpen()).toBe(true);
    expect(fixture.debugElement.query(By.css('[data-testid="studio-toggle-inspector"]'))).toBeNull();
  });
});
