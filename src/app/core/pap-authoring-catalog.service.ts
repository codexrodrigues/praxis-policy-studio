import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { PolicyStudioRuntimeConfig } from './runtime-config';

export interface PapFact {
  readonly factPath: string;
  readonly valueType: string;
  readonly cardinality: string;
  readonly presenceModel: string;
}

export interface PapPoint {
  readonly pointKey: string;
  readonly resourceKey: string;
  readonly descriptorDigest: string;
  readonly factContractId: string;
  readonly factContractDigest: string;
  readonly factsByMode: Readonly<Record<string, readonly PapFact[]>>;
}

export interface PapService {
  readonly serviceKey: string;
  readonly catalogDigest: string;
  readonly decisionPoints: readonly PapPoint[];
}

@Injectable({ providedIn: 'root' })
export class PapAuthoringCatalogService {
  private readonly http = inject(HttpClient);

  load(config: PolicyStudioRuntimeConfig) {
    if (config.mode !== 'remote' || config.configApiBaseUrl === null) throw new Error('PAP_HOST_REQUIRED');
    const base = config.configApiBaseUrl.replace(/\/$/, '');
    return this.http.get<{ readonly services: readonly PapService[] }>(
      `${base}/api/praxis/config/domain-rules/authorization/catalog`, { withCredentials: true });
  }
}
