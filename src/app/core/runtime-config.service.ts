import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PolicyStudioRuntimeConfig, validateRuntimeConfig } from './runtime-config';

export type SetupState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly config: PolicyStudioRuntimeConfig }
  | { readonly kind: 'error'; readonly code: string };

@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  private readonly http = inject(HttpClient);
  private readonly stateSignal = signal<SetupState>({ kind: 'loading' });
  readonly state = this.stateSignal.asReadonly();
  readonly ready = computed(() => this.stateSignal().kind === 'ready');

  async load(): Promise<void> {
    this.stateSignal.set({ kind: 'loading' });
    try {
      const raw = await firstValueFrom(this.http.get<unknown>('/app-config.json'));
      this.stateSignal.set({ kind: 'ready', config: validateRuntimeConfig(raw) });
    } catch (error: unknown) {
      this.stateSignal.set({
        kind: 'error',
        code: error instanceof Error ? error.message : 'SETUP_LOAD_FAILED'
      });
    }
  }
}

