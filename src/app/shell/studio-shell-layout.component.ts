import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { PraxisThemeService } from '@praxisui/core';
import { filter } from 'rxjs';
import { GovernedHostScopeService } from '../core/governed-host-scope.service';
import { humanizeDecisionTitle, looksLikeTechnicalSlug } from '../core/humanize-labels';
import { PolicyStudioI18n } from '../core/i18n';
import { RuntimeConfigService } from '../core/runtime-config.service';
import { StudioCapabilitiesService } from '../core/studio-capabilities.service';
import { StudioCatalogBootstrapService } from '../core/studio-catalog-bootstrap.service';
import type { CommandPaletteActionId } from '../core/studio-command-palette';
import {
  STUDIO_NAV_ITEMS,
  buildVisibleNavGroups,
  extractPreservedEnvironmentQueryParams,
  findNavItemById,
  resolveNavItemFromUrl,
  type VisibleStudioNavItem
} from '../core/studio-navigation';
import { StudioShellStateService } from '../core/studio-shell-state.service';
import { StudioTitleStrategy } from '../core/studio-title.strategy';
import { CatalogSelectionStore, type DecisionWorkMode } from '../features/catalog/catalog-selection.store';
import type { DecisionSummary } from '../features/catalog/catalog.fixture';
import { StudioCommandPaletteComponent } from '../features/catalog/studio-command-palette.component';
import { StudioIconComponent } from '../shared/studio-icon.component';
import { StudioEnvironmentMenuComponent } from './studio-environment-menu.component';
import { StudioSidebarNavComponent } from './studio-sidebar-nav.component';

@Component({
  selector: 'pax-studio-shell-layout',
  standalone: true,
  imports: [
    RouterLink,
    RouterOutlet,
    StudioIconComponent,
    StudioSidebarNavComponent,
    StudioEnvironmentMenuComponent,
    StudioCommandPaletteComponent
  ],
  templateUrl: './studio-shell-layout.component.html',
  styleUrl: './studio-shell-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StudioShellLayoutComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly theme = inject(PraxisThemeService);
  private readonly capabilities = inject(StudioCapabilitiesService);
  private readonly bootstrap = inject(StudioCatalogBootstrapService);
  private readonly titleStrategy = inject(StudioTitleStrategy, { optional: true });

  readonly runtime = inject(RuntimeConfigService);
  readonly i18n = inject(PolicyStudioI18n);
  readonly hostScope = inject(GovernedHostScopeService);
  readonly shell = inject(StudioShellStateService);
  readonly store = inject(CatalogSelectionStore);

  readonly activeNavConfig = computed(() => findNavItemById(this.shell.activeNavItem()));
  readonly supportsExplorer = computed(() => this.activeNavConfig().supportsExplorer);
  readonly supportsInspector = computed(() => this.activeNavConfig().supportsInspector);

  readonly visibleNavGroups = computed(() =>
    buildVisibleNavGroups(
      STUDIO_NAV_ITEMS,
      item => this.capabilities.isModuleVisible(item),
      { reviewQueue: this.store.reviewQueueDecisions().length }
    )
  );

  readonly activeBreadcrumbLabel = computed(() => {
    const activeNav = this.shell.activeNavItem();
    if (activeNav === 'catalog') {
      const current = this.store.selected();
      if (!current) {
        return this.i18n.text('navItemCatalog');
      }
      const docTitle = (current.workspaceDocumentation?.title ?? current.documentation?.title)?.trim();
      if (this.shell.viewDepth() === 'business' && docTitle && !looksLikeTechnicalSlug(docTitle)) {
        return docTitle;
      }
      return humanizeDecisionTitle(
        current.name,
        current.code,
        docTitle,
        this.shell.viewDepth(),
        this.i18n.locale()
      );
    }
    return this.i18n.text(findNavItemById(activeNav).labelKey);
  });

  readonly activeHostProfileLabel = computed(() => {
    const activeId = this.runtime.activeHostProfileId();
    const profiles = this.runtime.hostProfiles();
    if (activeId === 'custom') {
      const state = this.runtime.state();
      const baseUrl = state.kind === 'ready' ? state.config.configApiBaseUrl?.trim() : '';
      if (baseUrl) {
        try {
          return new URL(baseUrl).host || this.i18n.text('customHostProfileLabel');
        } catch {
          return this.i18n.text('customHostProfileLabel');
        }
      }
      return this.i18n.text('customHostProfileLabel');
    }
    const match = profiles.find(profile => profile.id === activeId) ?? profiles[0];
    if (!match) {
      return '';
    }
    return this.i18n.locale() === 'pt-BR' ? match.labelPtBr : match.labelEnUs;
  });

  ngOnInit(): void {
    const initialNav = resolveNavItemFromUrl(this.router.url);
    this.shell.setActiveNavItem(initialNav);
    this.titleStrategy?.syncForNavItem(initialNav);
    this.shell.registerNavigator((route, options) => {
      void this.navigateWithPreservedEnvironment(route, options?.preserveAllQueryParams ?? false);
    });
    this.shell.registerRootHandlers({
      logout: () => this.bootstrap.logout(),
      toggleTheme: () => this.theme.toggleDark(),
      sessionActive: () => this.store.sessionActive(),
      signingOut: () => this.store.signingOut(),
      isDarkTheme: () => this.theme.isDark()
    });

    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd | NavigationCancel =>
            event instanceof NavigationEnd || event instanceof NavigationCancel
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(event => {
        const url = event instanceof NavigationEnd ? event.urlAfterRedirects : this.router.url;
        this.shell.setActiveNavItem(resolveNavItemFromUrl(url));
      });

    this.destroyRef.onDestroy(() => {
      this.shell.registerNavigator(null);
      this.shell.registerRootHandlers(null);
    });
  }

  onSidebarItemSelected(item: VisibleStudioNavItem): void {
    if (this.router.url.split('?')[0] === item.route) {
      return;
    }
    void this.navigateWithPreservedEnvironment(item.route, false);
  }

  openAiAssistant(): void {
    this.shell.openInspectorTab('ai');
    if (this.router.url.split('?')[0] !== '/catalog') {
      void this.navigateWithPreservedEnvironment('/catalog', false);
    }
  }

  selectDecisionFromPalette(decision: DecisionSummary): void {
    this.shell.closeCommandPalette();
    this.store.activeRuleTypeFilter.set(null);
    if (!this.store.decisions().some(item => item.key === decision.key)) {
      this.store.contextScopeFilter.set(null);
    }
    this.bootstrap.requestOpenInCatalog(decision, 'understand');
  }

  selectScopeFromPalette(scopeKey: string): void {
    const normalized = scopeKey.trim();
    this.shell.closeCommandPalette();
    if (!normalized) return;
    const bridge = this.shell.catalogBridge();
    if (bridge) {
      bridge.applyScope(normalized);
      return;
    }
    this.store.deepLinkConsumed.set(true);
    this.store.contextScopeFilter.set(normalized);
    this.store.activeRuleTypeFilter.set(null);
    const matching = this.store.decisions();
    const current = this.store.selected();
    if (matching.length > 0 && (!current || !matching.some(item => item.key === current.key))) {
      this.bootstrap.requestOpenInCatalog(matching[0]!, 'understand');
      return;
    }
    void this.navigateWithPreservedEnvironment('/catalog', false);
  }

  handleCommandPaletteAction(actionId: CommandPaletteActionId): void {
    this.shell.closeCommandPalette();
    switch (actionId) {
      case 'open-portfolio':
        void this.navigateWithPreservedEnvironment('/overview', false);
        return;
      case 'open-reviews':
        void this.navigateWithPreservedEnvironment('/reviews', false);
        return;
      case 'toggle-depth':
        this.shell.toggleViewDepth();
        return;
      case 'open-access-privacy': {
        const current = this.store.selected();
        if (current) {
          const resourceKey =
            current.resourceKey?.trim()
            || current.ruleSetKey?.trim()
            || current.domain?.trim()
            || current.key;
          this.shell.openAccessBridge({
            resourceKey,
            serviceKey: current.serviceKey?.trim() || null,
            domainLabel: current.domainLabel?.trim() || current.domain?.trim() || '',
            ruleTitle: current.name,
            decisionKey: current.key,
            sensitiveFactsCount: current.facts.filter(
              fact => fact.sensitivity && fact.sensitivity.toUpperCase() !== 'NON_SENSITIVE'
            ).length
          });
        } else {
          void this.navigateWithPreservedEnvironment('/access', false);
        }
        return;
      }
      case 'open-ai':
        this.openAiAssistant();
        return;
      case 'toggle-theme':
        this.shell.toggleTheme();
        return;
      case 'nav-understand':
        this.jumpToCatalogMode('understand');
        return;
      case 'nav-rule':
        this.jumpToCatalogMode('rule');
        return;
      case 'nav-test':
        this.jumpToCatalogMode('test');
        return;
      case 'nav-operate':
        this.jumpToCatalogMode('operate');
        return;
      case 'nav-history':
        this.jumpToCatalogMode('history');
        return;
    }
  }

  private jumpToCatalogMode(mode: DecisionWorkMode): void {
    const bridge = this.shell.catalogBridge();
    if (bridge) {
      bridge.openMode(mode);
      return;
    }
    this.store.pendingWorkMode.set(mode);
    this.store.activeMode.set(mode);
    this.store.narrowDetailOpen.set(true);
    if (this.router.url.split('?')[0] !== '/catalog') {
      void this.navigateWithPreservedEnvironment('/catalog', false);
    }
  }

  private navigateWithPreservedEnvironment(
    route: string,
    preserveAllQueryParams: boolean
  ): Promise<boolean> {
    if (preserveAllQueryParams) {
      return this.router.navigate([route], { queryParamsHandling: 'preserve' });
    }
    const search = typeof window !== 'undefined' ? window.location.search : '';
    return this.router.navigate([route], {
      queryParams: extractPreservedEnvironmentQueryParams(search)
    });
  }

  @HostListener('window:keydown', ['$event'])
  handleGlobalShortcuts(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.shell.toggleCommandPalette();
      return;
    }
    if (this.shell.commandPaletteOpen()) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      this.shell.toggleSidebar();
      return;
    }
    if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      this.shell.toggleViewDepth();
      return;
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
      if (event.key === '[' && this.supportsExplorer()) {
        event.preventDefault();
        this.shell.toggleExplorer();
        return;
      }
      if (event.key === ']' && this.supportsInspector()) {
        event.preventDefault();
        this.shell.toggleInspector();
      }
    }
  }
}
