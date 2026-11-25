import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { PolicyStudioI18n } from '../../core/i18n';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import { StudioCatalogBootstrapService } from '../../core/studio-catalog-bootstrap.service';
import { StudioShellStateService } from '../../core/studio-shell-state.service';
import { AccessAuthorizationWorkspaceComponent } from '../catalog/access-authorization-workspace.component';
import { CatalogSelectionStore } from '../catalog/catalog-selection.store';

@Component({
  selector: 'pax-access-page',
  standalone: true,
  imports: [AccessAuthorizationWorkspaceComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pax-access-authorization-workspace
      [config]="store.policyConfig()"
      [viewDepth]="shell.viewDepth()"
      [isRemoteMode]="runtime.mode() === 'remote'"
      [sessionActive]="store.sessionActive()"
      [loading]="store.loading()"
      [loadError]="store.loadError()"
      [permissionLimited]="store.permissionLimited()"
      [signingOut]="store.signingOut()"
      [bridgeContext]="shell.accessBridgeContext()"
      (clearBridgeContextRequested)="shell.clearAccessBridgeContext()"
      (backToBusinessRequested)="returnToBusinessCatalog()" />
  `,
  styles: [`
    :host {
      display: block;
      min-width: 0;
    }
  `]
})
export class AccessPageComponent implements OnInit {
  readonly store = inject(CatalogSelectionStore);
  readonly runtime = inject(RuntimeConfigService);
  readonly shell = inject(StudioShellStateService);
  readonly bootstrap = inject(StudioCatalogBootstrapService);
  readonly i18n = inject(PolicyStudioI18n);

  ngOnInit(): void {
    this.shell.setActiveNavItem('access');
    this.shell.setBreadcrumbs([{ label: this.i18n.text('navItemAccess') }]);
    this.bootstrap.ensureLoaded();
  }

  returnToBusinessCatalog(): void {
    this.shell.setActiveNavItem('catalog');
    this.shell.navigateToRoute('/catalog');
  }
}
