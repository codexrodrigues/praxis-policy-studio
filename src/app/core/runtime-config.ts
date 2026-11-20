export type PolicyStudioMode = 'fixture' | 'remote';
export type SupportedLocale = 'pt-BR' | 'en-US';

export interface PolicyStudioRuntimeConfig {
  readonly mode: PolicyStudioMode;
  readonly hostProfiles?: readonly RulesStudioHostProfile[];
  readonly configApiBaseUrl: string | null;
  readonly locale: SupportedLocale;
  readonly projectionPath: string | null;
  readonly initialDecisionKey: string | null;
}

export interface RulesStudioHostProfile {
  readonly id: string;
  readonly labelPtBr: string;
  readonly labelEnUs: string;
  readonly apiBaseUrl: string;
}

export const DEFAULT_RULES_STUDIO_HOST_PROFILES: readonly RulesStudioHostProfile[] = [
  {
    id: 'same-origin-proxy',
    labelPtBr: 'Host ativo (Proxy)',
    labelEnUs: 'Active host (Proxy)',
    apiBaseUrl: ''
  },
  {
    id: 'quickstart-local',
    labelPtBr: 'Quickstart (:8088)',
    labelEnUs: 'Quickstart (:8088)',
    apiBaseUrl: 'http://127.0.0.1:8088'
  },
  {
    id: 'enterprise-rh-local',
    labelPtBr: 'Host Corporativo RH (:8080)',
    labelEnUs: 'Enterprise HR Host (:8080)',
    apiBaseUrl: 'http://127.0.0.1:8080'
  },
  {
    id: 'enterprise-showcase-local',
    labelPtBr: 'Enterprise Showcase (:8089)',
    labelEnUs: 'Enterprise Showcase (:8089)',
    apiBaseUrl: 'http://127.0.0.1:8089'
  }
];

export function normalizeTrustedConfigApiBaseUrl(
  rawUrl: string | null | undefined,
  allowedOrigins: readonly string[] = DEFAULT_RULES_STUDIO_HOST_PROFILES.map(p => p.apiBaseUrl).filter(Boolean)
): string | null {
  if (rawUrl === undefined || rawUrl === null) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }
  const isLoopback = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  const isSameBrowserOrigin =
    typeof window !== 'undefined' && parsed.origin === window.location?.origin;
  const isAllowlisted = allowedOrigins.some(entry => {
    try {
      return new URL(entry).origin === parsed.origin;
    } catch {
      return false;
    }
  });
  if (!isLoopback && !isSameBrowserOrigin && !isAllowlisted) {
    return null;
  }
  const cleanPath = parsed.pathname.replace(/\/+$/, '').replace(/\/api$/i, '');
  return `${parsed.origin}${cleanPath}`;
}

function validateDeploymentProfiles(value: unknown, defaultOrigin: string | null | undefined): readonly RulesStudioHostProfile[] {
  if (!Array.isArray(value) || !value.length) throw new Error('SETUP_INVALID_HOST_PROFILES');
  const ids = new Set<string>();
  const origins = new Set<string>();
  const profiles = value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('SETUP_INVALID_HOST_PROFILES');
    const { id, labelPtBr, labelEnUs, apiBaseUrl } = entry as Partial<RulesStudioHostProfile>;
    if (typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(id) || ids.has(id)
      || typeof labelPtBr !== 'string' || !labelPtBr.trim() || typeof labelEnUs !== 'string' || !labelEnUs.trim()
      || typeof apiBaseUrl !== 'string' || !URL.canParse(apiBaseUrl)) throw new Error('SETUP_INVALID_HOST_PROFILES');
    const url = new URL(apiBaseUrl);
    if (url.protocol !== 'https:' || url.hostname.includes('*') || url.origin !== apiBaseUrl || origins.has(apiBaseUrl)) {
      throw new Error('SETUP_INVALID_HOST_PROFILES');
    }
    ids.add(id);
    origins.add(apiBaseUrl);
    return { id, labelPtBr, labelEnUs, apiBaseUrl };
  });
  if (!defaultOrigin || !origins.has(defaultOrigin)) throw new Error('SETUP_INVALID_HOST_PROFILES');
  return profiles;
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
  if (candidate.projectionPath != null
      && (!candidate.projectionPath.startsWith('/projections/') || !candidate.projectionPath.endsWith('.json'))) {
    throw new Error('SETUP_PROJECTION_PATH_REQUIRED');
  }
  if (candidate.mode === 'fixture' && candidate.projectionPath == null) {
    throw new Error('SETUP_PROJECTION_PATH_REQUIRED');
  }
  const hostProfiles = candidate.hostProfiles === undefined ? undefined
    : validateDeploymentProfiles(candidate.hostProfiles, candidate.configApiBaseUrl);
  return {
    ...(hostProfiles ? { hostProfiles } : {}),
    mode: candidate.mode,
    configApiBaseUrl: candidate.configApiBaseUrl ?? null,
    locale: candidate.locale,
    projectionPath: candidate.projectionPath ?? null,
    initialDecisionKey: candidate.initialDecisionKey?.trim() || null
  };
}

export type RulesStudioMode = PolicyStudioMode;
export type RulesStudioRuntimeConfig = PolicyStudioRuntimeConfig;
