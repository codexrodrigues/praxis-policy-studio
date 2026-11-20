import { Injectable, signal } from '@angular/core';

export interface GovernedHostScopeSnapshot {
  readonly tenantId: string | null;
  readonly organizationId: string | null;
  readonly environment: string | null;
}

const REALM_SLUG_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;

function cleanParam(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 128 ? trimmed : null;
}

function readWindowQueryScope(): GovernedHostScopeSnapshot {
  if (typeof window === 'undefined' || !window.location?.search) {
    return { tenantId: null, organizationId: null, environment: null };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    tenantId: cleanParam(params.get('tenantId')),
    organizationId: cleanParam(params.get('organizationId')),
    environment: cleanParam(params.get('environment'))
  };
}

/**
 * Maintains the host scope coordinates (`tenantId`, `organizationId`, `environment`)
 * received via deep-link URL parameters and the in-memory `X-XSRF-TOKEN` captured
 * from governed session responses (`/auth/session`, `/auth/login`).
 *
 * Credentials and CSRF tokens are kept strictly in memory and never persisted to
 * `localStorage` or `sessionStorage`.
 */
@Injectable({ providedIn: 'root' })
export class GovernedHostScopeService {
  private readonly scopeSignal = signal<GovernedHostScopeSnapshot>(readWindowQueryScope());
  private readonly csrfTokensByScope = new Map<string, string>();

  readonly scope = this.scopeSignal.asReadonly();

  syncFromQueryString(search?: string | null): GovernedHostScopeSnapshot {
    if (search === undefined) {
      const current = this.scopeSignal();
      if (current.tenantId || current.organizationId || current.environment) {
        return current;
      }
      const next = readWindowQueryScope();
      if (next.tenantId || next.organizationId || next.environment) {
        this.scopeSignal.set(next);
      }
      return this.scopeSignal();
    }
    const params = new URLSearchParams(search ?? '');
    const next: GovernedHostScopeSnapshot = {
      tenantId: cleanParam(params.get('tenantId')),
      organizationId: cleanParam(params.get('organizationId')),
      environment: cleanParam(params.get('environment'))
    };
    this.scopeSignal.set(next);
    return next;
  }

  setScope(partial: Partial<GovernedHostScopeSnapshot>): void {
    const current = this.scopeSignal();
    this.scopeSignal.set({
      tenantId: partial.tenantId !== undefined ? cleanParam(partial.tenantId) : current.tenantId,
      organizationId: partial.organizationId !== undefined ? cleanParam(partial.organizationId) : current.organizationId,
      environment: partial.environment !== undefined ? cleanParam(partial.environment) : current.environment
    });
  }

  isRealmSlug(tenantId: string | null | undefined): boolean {
    return !!tenantId && REALM_SLUG_PATTERN.test(tenantId);
  }

  recordCsrfToken(token: string, origin: string, tenantId: string | null): void {
    const clean = cleanParam(token);
    if (clean) this.csrfTokensByScope.set(JSON.stringify([origin, tenantId]), clean);
  }

  csrfToken(origin: string, tenantId: string | null): string | null {
    return this.csrfTokensByScope.get(JSON.stringify([origin, tenantId])) ?? null;
  }
}
