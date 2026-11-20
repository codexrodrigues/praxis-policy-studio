import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { AccessReleaseService, isConfigId, type AccessRelease, type AccessReleaseTransition, type ApprovedAccessDefinition } from '../../core/access-release.service';
import { GovernedHostScopeService } from '../../core/governed-host-scope.service';
import { PolicyStudioI18n, type CopyKey } from '../../core/i18n';
import type { PolicyStudioRuntimeConfig } from '../../core/runtime-config';
import { GovernedConfirmationDialogComponent } from '../catalog/governed-confirmation-dialog.component';

@Component({
  selector: 'pax-access-release',
  providers: [AccessReleaseService],
  imports: [GovernedConfirmationDialogComponent],
  templateUrl: './access-release.component.html',
  styleUrl: './access-release.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccessReleaseComponent {
  readonly config = input.required<PolicyStudioRuntimeConfig>();
  readonly i18n = inject(PolicyStudioI18n);
  private readonly api = inject(AccessReleaseService);
  private readonly scope = inject(GovernedHostScopeService);
  private request?: Subscription;

  readonly definitions = signal<readonly ApprovedAccessDefinition[] | null>(null);
  readonly definitionId = signal('');
  readonly releaseId = signal('');
  readonly release = signal<AccessRelease | null>(null);
  readonly busy = signal(false);
  readonly error = signal<CopyKey | null>(null);
  readonly command = signal<AccessReleaseTransition | null>(null);
  readonly confirmation = computed(() => {
    const command = this.command();
    const release = this.release();
    if (!command || !release) return null;
    const label = this.i18n.text(command === 'activate' ? 'releaseActivate' : 'releaseRollback');
    return { title: label, message: this.i18n.text('releaseConfirmTransition'), target: release.releaseId,
      confirmLabel: label, cancelLabel: this.i18n.text('cancel') };
  });

  constructor() {
    effect(onCleanup => {
      this.config();
      this.scope.scope();
      this.definitions.set(null);
      this.definitionId.set('');
      this.editReleaseId('');
      this.busy.set(false);
      onCleanup(() => this.request?.unsubscribe());
    });
  }

  loadApproved(): void {
    if (this.busy()) return;
    this.definitionId.set('');
    this.definitions.set(null);
    this.run(this.api.approved(this.config()), items => this.definitions.set(items), 'releaseListFailed');
  }

  publish(): void {
    const id = this.definitionId();
    if (this.busy() || !this.definitions()?.some(item => item.id === id)) return;
    this.editReleaseId('');
    this.run(this.api.publish(this.config(), id), item => this.show(item), 'releasePublishFailed');
  }

  editReleaseId(id: string): void {
    this.releaseId.set(id);
    this.release.set(null);
    this.command.set(null);
    this.error.set(null);
  }

  read(): void {
    if (this.busy()) return;
    const id = this.releaseId().trim();
    this.editReleaseId(id);
    if (!isConfigId(id)) {
      this.error.set('releaseIdRequired');
      return;
    }
    this.run(this.api.get(this.config(), id), item => this.show(item), 'releaseReadFailed');
  }

  confirm(): void {
    const command = this.command();
    const release = this.release();
    this.command.set(null);
    if (this.busy() || !release || !command || !this.canTransition(command, release)) return;
    this.release.set(null);
    this.run(this.api.transition(this.config(), release, command), item => this.show(item), 'releaseChangeFailed');
  }

  canTransition(command: AccessReleaseTransition, release: AccessRelease): boolean {
    if (command === 'activate') return release.state === 'published' || release.state === 'activating';
    return release.state === 'reverting' || (release.state === 'active' && release.current !== false)
      || (release.state === 'activating' && release.current === true);
  }

  private show(item: AccessRelease): void {
    this.releaseId.set(item.releaseId);
    this.release.set(item);
  }

  private run<T>(request: Observable<T>, receive: (value: T) => void, fallback: CopyKey): void {
    this.busy.set(true);
    this.error.set(null);
    this.request = request.subscribe({
      next: value => {
        this.busy.set(false);
        receive(value);
      },
      error: failure => {
        this.busy.set(false);
        const status = failure instanceof HttpErrorResponse ? failure.status : 0;
        this.error.set(status === 401 ? 'authenticationRequired' : status === 403 ? 'permissionLimited' : fallback);
      }
    });
  }
}
