import { JsonPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { GovernedHostScopeService } from '../../core/governed-host-scope.service';
import { type CopyKey, PolicyStudioI18n } from '../../core/i18n';
import { PapAuthoringCatalogService, type PapService } from '../../core/pap-authoring-catalog.service';
import type { PolicyStudioRuntimeConfig } from '../../core/runtime-config';

@Component({
  selector: 'pax-pap-catalog',
  imports: [JsonPipe],
  templateUrl: './pap-catalog.component.html',
  styleUrl: './pap-catalog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PapCatalogComponent {
  readonly config = input.required<PolicyStudioRuntimeConfig>();
  readonly i18n = inject(PolicyStudioI18n);
  private readonly catalog = inject(PapAuthoringCatalogService);
  private readonly scope = inject(GovernedHostScopeService);
  private request?: Subscription;

  readonly services = signal<readonly PapService[] | null>(null);
  readonly busy = signal(false);
  readonly error = signal<CopyKey | null>(null);
  readonly serviceKey = linkedSignal(() => this.services()?.[0]?.serviceKey ?? '');
  readonly service = computed(() => this.services()?.find(item => item.serviceKey === this.serviceKey()));
  readonly pointKey = linkedSignal(() => this.service()?.decisionPoints[0]?.pointKey ?? '');
  readonly point = computed(() => this.service()?.decisionPoints.find(item => item.pointKey === this.pointKey()));
  readonly modes = computed(() => Object.keys(this.point()?.factsByMode ?? {}));
  readonly mode = linkedSignal(() => this.modes()[0] ?? '');
  readonly reference = computed(() => ({
    kind: 'EXACT', pointKey: this.pointKey(), expectedDescriptorDigest: this.point()?.descriptorDigest,
    evaluationModes: [this.mode()]
  }));

  constructor() {
    effect(onCleanup => {
      this.config();
      this.scope.scope();
      this.services.set(null);
      this.error.set(null);
      this.busy.set(false);
      onCleanup(() => this.request?.unsubscribe());
    });
  }

  load(): void {
    if (this.config().mode !== 'remote' || this.busy()) return;
    this.busy.set(true);
    this.services.set(null);
    this.error.set(null);
    this.request = this.catalog.load(this.config()).subscribe({
      next: result => {
        this.busy.set(false);
        if (Array.isArray(result?.services)) this.services.set(result.services);
        else this.error.set('papUnavailable');
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        const status = failure instanceof HttpErrorResponse ? failure.status : 0;
        this.error.set(status === 401 ? 'authenticationRequired' : status === 403 ? 'permissionLimited' : 'papUnavailable');
      }
    });
  }
}
