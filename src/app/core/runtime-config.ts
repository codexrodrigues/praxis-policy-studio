export type PolicyStudioMode = 'fixture' | 'remote';
export type SupportedLocale = 'pt-BR' | 'en-US';

export interface PolicyStudioRuntimeConfig {
  readonly mode: PolicyStudioMode;
  readonly configApiBaseUrl: string | null;
  readonly locale: SupportedLocale;
  readonly projectionPath: string;
  readonly initialDecisionKey: string | null;
}

export function validateRuntimeConfig(value: unknown): PolicyStudioRuntimeConfig {
  if (!value || typeof value !== 'object') {
    throw new Error('SETUP_INVALID_DOCUMENT');
  }
  const candidate = value as Partial<PolicyStudioRuntimeConfig>;
  if (candidate.mode !== 'fixture' && candidate.mode !== 'remote') {
    throw new Error('SETUP_INVALID_MODE');
  }
  if (candidate.locale !== 'pt-BR' && candidate.locale !== 'en-US') {
    throw new Error('SETUP_INVALID_LOCALE');
  }
  if (candidate.mode === 'remote' && typeof candidate.configApiBaseUrl !== 'string') {
    throw new Error('SETUP_REMOTE_ENDPOINT_REQUIRED');
  }
  if (!candidate.projectionPath?.startsWith('/projections/') || !candidate.projectionPath.endsWith('.json')) {
    throw new Error('SETUP_PROJECTION_PATH_REQUIRED');
  }
  return {
    mode: candidate.mode,
    configApiBaseUrl: candidate.configApiBaseUrl ?? null,
    locale: candidate.locale,
    projectionPath: candidate.projectionPath,
    initialDecisionKey: candidate.initialDecisionKey?.trim() || null
  };
}
