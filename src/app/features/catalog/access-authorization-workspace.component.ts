import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { PolicyStudioI18n } from '../../core/i18n';
import type { PolicyStudioRuntimeConfig } from '../../core/runtime-config';
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
  readonly isRemoteMode = input(false);
  readonly sessionActive = input(false);
  readonly loading = input(false);
  readonly loadError = input<string | null>(null);
  readonly permissionLimited = input(false);
  readonly signingOut = input(false);

  readonly backToBusinessRequested = output<void>();
}
