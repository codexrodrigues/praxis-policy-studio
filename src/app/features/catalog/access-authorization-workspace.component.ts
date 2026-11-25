import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { PolicyStudioI18n } from '../../core/i18n';
import type { PolicyStudioRuntimeConfig } from '../../core/runtime-config';
import type { StudioAccessBridgeContext, StudioViewDepth } from '../../core/studio-shell-state.service';
import { StudioIconComponent } from '../../shared/studio-icon.component';
import { AccessDraftReviewComponent } from '../authoring/access-draft-review.component';

@Component({
  selector: 'pax-access-authorization-workspace',
  imports: [AccessDraftReviewComponent, StudioIconComponent],
  templateUrl: './access-authorization-workspace.component.html',
  styleUrl: './access-authorization-workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccessAuthorizationWorkspaceComponent {
  readonly i18n = inject(PolicyStudioI18n);

  readonly config = input<PolicyStudioRuntimeConfig | null>(null);
  readonly viewDepth = input<StudioViewDepth>('business');
  readonly isRemoteMode = input(false);
  readonly sessionActive = input(false);
  readonly loading = input(false);
  readonly loadError = input<string | null>(null);
  readonly permissionLimited = input(false);
  readonly signingOut = input(false);
  readonly bridgeContext = input<StudioAccessBridgeContext | null>(null);

  readonly backToBusinessRequested = output<void>();
  readonly clearBridgeContextRequested = output<void>();

  sensitiveFactsBadge(count: number): string {
    return this.i18n.format('accessBridgeBannerSensitive', { count });
  }
}
