import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap, throwError } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';
import { GovernedHostScopeService } from './governed-host-scope.service';

const GOVERNED_ROOTS = ['/api', '/auth', '/schemas'] as const;
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Carries the host-owned HttpOnly session, deep-link tenant/organization scope
 * headers, and in-memory `X-XSRF-TOKEN` only to Praxis governance surfaces.
 *
 * Relative URLs work behind the local same-origin proxy. Absolute URLs are used
 * by a separately deployed Studio and require `withCredentials` for the same
 * session contract. Static assets, projections and unrelated external URLs do
 * not receive ambient credentials or contextual headers.
 */
export const governedCredentialsInterceptor: HttpInterceptorFn = (request, next) => {
  const url = new URL(request.url, document.baseURI);
  if (!GOVERNED_ROOTS.some(root => url.pathname === root || url.pathname.startsWith(root + '/'))) return next(request);
  const state = inject(RuntimeConfigService).state();
  if (state.kind !== 'ready' || state.config.mode !== 'remote'
    || url.origin !== new URL(state.config.configApiBaseUrl || document.baseURI, document.baseURI).origin) {
    return throwError(() => new Error('GOVERNED_HOST_MISMATCH'));
  }

  const hostScope = inject(GovernedHostScopeService);
  const scope = hostScope.syncFromQueryString();
  const setHeaders: Record<string, string> = {};

  if (scope.tenantId) {
    if (!request.headers.has('X-Tenant-ID')) {
      setHeaders['X-Tenant-ID'] = scope.tenantId;
    }
    if (hostScope.isRealmSlug(scope.tenantId) && !request.headers.has('X-Tenant-Realm')) {
      setHeaders['X-Tenant-Realm'] = scope.tenantId;
    }
  }
  if (scope.organizationId && !request.headers.has('X-Organization-ID')) {
    setHeaders['X-Organization-ID'] = scope.organizationId;
  }
  if (scope.environment && !request.headers.has('X-Env')) {
    setHeaders['X-Env'] = scope.environment;
  }
  if (MUTATING_METHODS.has(request.method.toUpperCase()) && !request.headers.has('X-XSRF-TOKEN')) {
    const csrf = hostScope.csrfToken(url.origin, scope.tenantId);
    if (csrf) {
      setHeaders['X-XSRF-TOKEN'] = csrf;
    }
  }

  const cloned =
    request.withCredentials && Object.keys(setHeaders).length === 0
      ? request
      : request.clone({
          withCredentials: true,
          ...(Object.keys(setHeaders).length > 0 ? { setHeaders } : {})
        });

  return next(cloned).pipe(
    tap(event => {
      if (event instanceof HttpResponse) {
        const nextCsrf = event.headers.get('X-XSRF-TOKEN');
        if (nextCsrf) {
          hostScope.recordCsrfToken(nextCsrf, url.origin, scope.tenantId);
        }
      }
    })
  );
};
