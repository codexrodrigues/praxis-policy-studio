import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  DEFAULT_RULES_STUDIO_HOST_PROFILES,
  PolicyStudioRuntimeConfig,
  RulesStudioHostProfile,
  normalizeTrustedConfigApiBaseUrl,
  validateRuntimeConfig
} from './runtime-config';

export type SetupState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly config: PolicyStudioRuntimeConfig }
  | { readonly kind: 'error'; readonly code: string };

@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  private readonly http = inject(HttpClient);
  private readonly stateSignal = signal<SetupState>({ kind: 'loading' });
  readonly hostProfiles = computed<readonly RulesStudioHostProfile[]>(() => {
    const state = this.stateSignal();
    return state.kind === 'ready' && state.config.hostProfiles ? state.config.hostProfiles : DEFAULT_RULES_STUDIO_HOST_PROFILES;
  });
  readonly state = this.stateSignal.asReadonly();
  readonly ready = computed(() => this.stateSignal().kind === 'ready');
  readonly mode = computed(() => {
    const state = this.stateSignal();
    return state.kind === 'ready' ? state.config.mode : null;
  });
  readonly activeHostProfileId = computed(() => {
    const state = this.stateSignal();
    if (state.kind !== 'ready' || state.config.mode !== 'remote') return null;
    const baseUrl = state.config.configApiBaseUrl ?? '';
    return this.hostProfiles().find(profile => profile.apiBaseUrl === baseUrl)?.id ?? 'custom';
  });

  async load(): Promise<void> {
    this.stateSignal.set({ kind: 'loading' });
    try {
      const raw = await firstValueFrom(this.http.get<unknown>('/app-config.json'));
      const validated = validateRuntimeConfig(raw);
      const queryOverride = this.resolveQueryApiBaseUrlOverride(validated);
      const nextConfig: PolicyStudioRuntimeConfig =
        validated.mode === 'remote' && queryOverride !== null && queryOverride !== validated.configApiBaseUrl
          ? {
              ...validated,
              configApiBaseUrl: queryOverride,
              initialDecisionKey: null,
              projectionPath: queryOverride ? null : validated.projectionPath
            }
          : validated;
      this.stateSignal.set({ kind: 'ready', config: nextConfig });
    } catch (error: unknown) {
      this.stateSignal.set({
        kind: 'error',
        code: error instanceof Error ? error.message : 'SETUP_LOAD_FAILED'
      });
    }
  }

  selectHostProfile(profileId: string): void {
    const current = this.stateSignal();
    if (current.kind !== 'ready' || current.config.mode !== 'remote') return;
    const target = this.hostProfiles().find(profile => profile.id === profileId);
    if (!target || target.apiBaseUrl === (current.config.configApiBaseUrl ?? '')) return;
    // A new document clears the previous host's session token, scope, draft and pending callbacks.
    const url = new URL(window.location.pathname, window.location.origin);
    url.searchParams.set('apiBaseUrl', target.apiBaseUrl);
    window.location.assign(url.href);
  }

  private resolveQueryApiBaseUrlOverride(config: PolicyStudioRuntimeConfig): string | null {
    if (typeof window === 'undefined' || !window.location?.search) return null;
    const params = new URLSearchParams(window.location.search);
    const rawApiBaseUrl = params.get('apiBaseUrl');
    if (rawApiBaseUrl === null) return null;
    if (config.hostProfiles) {
      const selected = config.hostProfiles.find(profile => profile.apiBaseUrl === rawApiBaseUrl);
      if (!selected) throw new Error('SETUP_UNTRUSTED_HOST');
      return selected.apiBaseUrl;
    }
    return normalizeTrustedConfigApiBaseUrl(rawApiBaseUrl);
  }
}
