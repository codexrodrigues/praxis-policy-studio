import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, TitleStrategy, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { governedCredentialsInterceptor } from './core/governed-credentials.interceptor';
import { StudioTitleStrategy } from './core/studio-title.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(withInterceptors([governedCredentialsInterceptor])),
    provideRouter(routes, withComponentInputBinding()),
    { provide: TitleStrategy, useClass: StudioTitleStrategy }
  ]
};
