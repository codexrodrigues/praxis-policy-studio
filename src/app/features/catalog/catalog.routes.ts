import { Routes } from '@angular/router';
import {
  PRAXIS_I18N_CONFIG,
  PraxisThemeService,
  providePraxisI18n,
  providePraxisTheme
} from '@praxisui/core';
import { PolicyStudioI18n } from '../../core/i18n';
import { CatalogWorkspaceComponent } from './catalog-workspace.component';

export const CATALOG_ROUTES: Routes = [
  {
    path: '',
    component: CatalogWorkspaceComponent,
    title: 'Catálogo — Praxis Rules Studio',
    providers: [
      providePraxisTheme({
        defaultTheme: 'light-tech',
        storageKeyPrefix: 'praxis-rules-studio-theme',
        scopeByRealm: false,
        persist: true
      }),
      ...providePraxisI18n({ fallbackLocale: 'pt-BR' }),
      {
        provide: PRAXIS_I18N_CONFIG,
        multi: true,
        useFactory: (studioI18n: PolicyStudioI18n) => ({
          get locale() {
            return studioI18n.locale();
          }
        }),
        deps: [PolicyStudioI18n]
      },
      PraxisThemeService
    ]
  }
];
