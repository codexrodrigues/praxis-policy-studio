import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { DomainRuleService } from '@praxisui/core';
import { map, switchMap, throwError } from 'rxjs';
import { AuthSessionService } from './auth-session.service';
import { AUTHORIZATION_RULE_TYPE, accessPreview } from './prepared-access-draft';
import type { PolicyStudioRuntimeConfig } from './runtime-config';

export type AccessReleaseState = 'published' | 'activating' | 'active' | 'reverting' | 'reverted';
export type AccessReleaseTransition = 'activate' | 'rollback';

interface RuntimeHead {
  readonly runtimeRevision: string;
  readonly instanceId: string;
  readonly activationRevision: number;
  readonly headEtag: string;
  readonly compilerProfileVersion: string;
  readonly opaCapabilitiesDigest: string;
  readonly policySetDigest: string;
  readonly bundleArtifactDigest: string;
}

export interface ApprovedAccessDefinition {
  readonly id: string;
  readonly ruleKey: string;
  readonly version?: number | null;
  readonly title: string;
}

export interface AccessRelease {
  readonly current?: boolean;
  readonly approvalId?: string | null;
  readonly releaseId: string;
  readonly definitionId: string;
  readonly definitionHash: string;
  readonly state: AccessReleaseState;
  readonly expectedHead: RuntimeHead | null;
  readonly observedHead: RuntimeHead | null;
}

export function isConfigId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}

function readRelease(value: AccessRelease, definitionId?: string, releaseId?: string): AccessRelease {
  if (!value || !isConfigId(value.releaseId) || !isConfigId(value.definitionId)
    || typeof value.definitionHash !== 'string' || !value.definitionHash.trim()
    || (value.current != null && typeof value.current !== 'boolean')
    || (value.approvalId != null && !isConfigId(value.approvalId))
    || !['published', 'activating', 'active', 'reverting', 'reverted'].includes(value.state)
    || (definitionId && definitionId !== value.definitionId) || (releaseId && releaseId !== value.releaseId)) {
    throw new Error('ACCESS_RELEASE_RESPONSE_MISMATCH');
  }
  const textFields = ['instanceId', 'runtimeRevision', 'policySetDigest', 'bundleArtifactDigest',
    'headEtag', 'compilerProfileVersion', 'opaCapabilitiesDigest'] as const;
  for (const head of [value.expectedHead, value.observedHead]) {
    if (head != null && (!textFields.every(key => typeof head[key] === 'string' && head[key].trim())
      || !Number.isSafeInteger(head.activationRevision) || head.activationRevision < 1)) {
      throw new Error('ACCESS_RELEASE_HEAD_INVALID');
    }
  }
  const { expectedHead, observedHead } = value;
  if ((value.state === 'active' || value.state === 'reverted')
    && (!observedHead || !expectedHead || observedHead.activationRevision !== expectedHead.activationRevision
      || textFields.some(key => observedHead[key] !== expectedHead[key]))) {
    throw new Error('ACCESS_RELEASE_OBSERVATION_REQUIRED');
  }
  return value;
}

@Injectable({ providedIn: 'root' })
export class AccessReleaseService {
  private readonly http = inject(HttpClient);
  private readonly rules = inject(DomainRuleService);
  private readonly auth = inject(AuthSessionService);

  approved(config: PolicyStudioRuntimeConfig) {
    const baseUrl = this.baseUrl(config);
    return this.rules.listDefinitions({ ruleType: AUTHORIZATION_RULE_TYPE, status: 'approved' }, { apiUrlEntry: { baseUrl } }).pipe(
      map(items => items.flatMap(item => {
        if (item.ruleType !== AUTHORIZATION_RULE_TYPE || item.status !== 'approved' || !isConfigId(item.id)) return [];
        try {
          const preview = accessPreview(item.definition);
          if (preview.targets.some(target => target.modes.some(mode => mode !== 'TARGET'))) return [];
          return [{ id: item.id, ruleKey: item.ruleKey, version: item.version, title: preview.title }];
        } catch {
          // The approved authorization catalog also contains policies outside the ACCESS review surface.
          return [];
        }
      }))
    );
  }

  get(config: PolicyStudioRuntimeConfig, id: string) {
    return this.http.get<AccessRelease>(this.url(config, id)).pipe(map(value => readRelease(value, undefined, id)));
  }

  publish(config: PolicyStudioRuntimeConfig, definitionId: string) {
    return this.post(config, this.url(config), { definitionId }).pipe(map(value => readRelease(value, definitionId)));
  }

  transition(config: PolicyStudioRuntimeConfig, release: AccessRelease, command: AccessReleaseTransition) {
    return this.post(config, this.url(config, release.releaseId) + '/' + command, null).pipe(map(value => {
      const next = readRelease(value, release.definitionId, release.releaseId);
      if (next.definitionHash !== release.definitionHash) throw new Error('ACCESS_RELEASE_DEFINITION_CHANGED');
      return next;
    }));
  }

  private post(config: PolicyStudioRuntimeConfig, url: string, body: { definitionId: string } | null) {
    return this.auth.hasSession(config).pipe(switchMap(active => active
      ? this.http.post<AccessRelease>(url, body)
      : throwError(() => new HttpErrorResponse({ status: 401 }))));
  }

  private baseUrl(config: PolicyStudioRuntimeConfig): string {
    if (config.mode !== 'remote' || config.configApiBaseUrl === null) throw new Error('ACCESS_RELEASE_HOST_REQUIRED');
    return config.configApiBaseUrl.replace(/\/$/, '');
  }

  private url(config: PolicyStudioRuntimeConfig, releaseId?: string): string {
    const base = this.baseUrl(config) + '/api/praxis/config/domain-rules/authorization/releases';
    return releaseId ? base + '/' + encodeURIComponent(releaseId) : base;
  }
}
