import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { GovernedHostScopeService } from './core/governed-host-scope.service';
import { PolicyStudioI18n } from './core/i18n';
import { RuntimeConfigService } from './core/runtime-config.service';
import { StudioShellStateService } from './core/studio-shell-state.service';
import { StudioIconComponent } from './shared/studio-icon.component';

@Component({
  selector: 'pax-root',
  imports: [RouterLink, RouterOutlet, StudioIconComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit {
  readonly runtime = inject(RuntimeConfigService);
  readonly i18n = inject(PolicyStudioI18n);
  readonly hostScope = inject(GovernedHostScopeService);
  readonly shell = inject(StudioShellStateService);

  readonly scopeBadges = computed(() => {
    const scope = this.hostScope.scope();
    const parts: string[] = [];
    if (scope.tenantId) parts.push(scope.tenantId);
    if (scope.organizationId) parts.push(scope.organizationId);
    if (scope.environment) parts.push(scope.environment);
    return parts;
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
    void this.runtime.load();
  }

  openAiAssistant(): void {
    this.shell.setWorkspaceTrack('business');
    this.shell.openInspectorTab('ai');
  }

  @HostListener('window:keydown', ['$event'])
  handleGlobalShortcuts(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.shell.toggleCommandPalette();
      return;
    }
    if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.toLowerCase() !== 'd') return;
    const target = event.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
    }
    event.preventDefault();
    this.shell.toggleViewDepth();
  }
}
