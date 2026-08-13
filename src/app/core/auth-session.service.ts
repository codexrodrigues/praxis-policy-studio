import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PolicyStudioRuntimeConfig } from './runtime-config';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly http = inject(HttpClient);

  login(username: string, password: string, config: PolicyStudioRuntimeConfig): Observable<void> {
    if (config.mode !== 'remote' || !config.configApiBaseUrl) throw new Error('AUTH_REMOTE_CONFIG_REQUIRED');
    return this.http.post<void>(`${config.configApiBaseUrl}/auth/login`, { username, password }, { withCredentials: true });
  }
}
