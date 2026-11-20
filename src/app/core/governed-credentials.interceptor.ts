import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap, throwError } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';
import { GovernedHostScopeService } from './governed-host-scope.service';

const GOVERNED_ROOTS = ['/api', '/auth', '/schemas'] as const;
const SESSION_PATHS = new Set(['/auth/session', '/auth/login', '/auth/logout']);
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
  const session = hostScope.csrfSession(url.origin, scope.tenantId);
  const sessionProbe = request.method === 'GET' && url.pathname === '/auth/session';
  const login = request.method === 'POST' && url.pathname === '/auth/login';
  const logout = request.method === 'POST' && url.pathname === '/auth/logout';
  const setHeaders: Record<string, string> = {};

  const sessionPath = SESSION_PATHS.has(url.pathname);
  const headers = sessionPath
    ? request.headers.delete('X-Tenant-ID').delete('X-Organization-ID').delete('X-Env')
    : request.headers;
  if (scope.tenantId && hostScope.isRealmSlug(scope.tenantId) && !headers.has('X-Tenant-Realm')) {
    setHeaders['X-Tenant-Realm'] = scope.tenantId;
  }
  if (!sessionPath) {
    if (scope.tenantId && !headers.has('X-Tenant-ID')) setHeaders['X-Tenant-ID'] = scope.tenantId;
    if (scope.organizationId && !headers.has('X-Organization-ID')) setHeaders['X-Organization-ID'] = scope.organizationId;
    if (scope.environment && !headers.has('X-Env')) setHeaders['X-Env'] = scope.environment;
  }
  if (MUTATING_METHODS.has(request.method.toUpperCase()) && !request.headers.has('X-XSRF-TOKEN')) {
    const csrf = session.token;
    if (csrf) {
      setHeaders['X-XSRF-TOKEN'] = csrf;
    }
  }

  return next(request.clone({ withCredentials: true, headers, setHeaders })).pipe(
    tap({
      next: event => {
        if (!(event instanceof HttpResponse)) return;
        const emitted = event.headers.get('X-XSRF-TOKEN');
        if (login || logout) {
          hostScope.rotateCsrfSession(url.origin, scope.tenantId, logout ? null : emitted);
        } else if (sessionProbe || emitted) {
          session.token = emitted;
        }
      },
      error: failure => {
        if (sessionProbe && failure instanceof HttpErrorResponse && failure.status === 401) {
          session.token = failure.headers.get('X-XSRF-TOKEN');
        }
      }
    })
  );
};
