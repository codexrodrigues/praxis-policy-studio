import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { GovernedHostScopeService } from './governed-host-scope.service';
import { PolicyStudioRuntimeConfig } from './runtime-config';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly http = inject(HttpClient);
  private readonly hostScope = inject(GovernedHostScopeService);

  ensureCsrf(config: PolicyStudioRuntimeConfig): Observable<void> {
    if (config.mode !== 'remote' || config.configApiBaseUrl === null) {
      return of(undefined);
    }
    const origin = new URL(config.configApiBaseUrl || document.baseURI, document.baseURI).origin;
    const scope = this.hostScope.syncFromQueryString();
    if (this.hostScope.csrfSession(origin, scope.tenantId).token) {
      return of(undefined);
    }
    return this.hasSession(config).pipe(
      switchMap(active => active ? of(undefined) : throwError(() => new HttpErrorResponse({ status: 401 })))
    );
  }

  login(username: string, password: string, config: PolicyStudioRuntimeConfig): Observable<void> {
    if (config.mode !== 'remote' || config.configApiBaseUrl === null) throw new Error('AUTH_REMOTE_CONFIG_REQUIRED');
    return this.hasSession(config).pipe(
      switchMap(() => this.http.post<void>(`${config.configApiBaseUrl}/auth/login`, { username, password }, { withCredentials: true })),
      switchMap(() => this.hasSession(config)),
      switchMap(active => active ? of(undefined) : throwError(() => new HttpErrorResponse({ status: 401 })))
    );
  }

  logout(config: PolicyStudioRuntimeConfig): Observable<void> {
    if (config.mode !== 'remote' || config.configApiBaseUrl === null) throw new Error('AUTH_REMOTE_CONFIG_REQUIRED');
    return this.hasSession(config).pipe(switchMap(active => active
      ? this.http.post<void>(`${config.configApiBaseUrl}/auth/logout`, null, { withCredentials: true })
      : of(undefined)));
  }

  hasSession(config: PolicyStudioRuntimeConfig): Observable<boolean> {
    if (config.mode !== 'remote' || config.configApiBaseUrl === null) throw new Error('AUTH_REMOTE_CONFIG_REQUIRED');
    return this.http.get<void>(`${config.configApiBaseUrl}/auth/session`, { withCredentials: true }).pipe(
      map(() => true),
      catchError((error: unknown) => error instanceof HttpErrorResponse && error.status === 401
        ? of(false)
        : throwError(() => error))
    );
  }
}
