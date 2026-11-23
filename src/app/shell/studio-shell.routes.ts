import { Routes } from '@angular/router';
import {
  API_URL,
  DomainRuleService,
  PRAXIS_I18N_CONFIG,
  PraxisThemeService,
  ResourceDiscoveryService,
  providePraxisI18n,
  providePraxisTheme,
  type ApiUrlConfig
} from '@praxisui/core';
import { AccessReleaseService } from '../core/access-release.service';
import { PolicyStudioI18n } from '../core/i18n';
import { ProjectionCatalogService } from '../core/projection-catalog.service';
import { StudioCatalogBootstrapService } from '../core/studio-catalog-bootstrap.service';
import { CatalogSelectionStore } from '../features/catalog/catalog-selection.store';
import { StudioShellLayoutComponent } from './studio-shell-layout.component';

export const STUDIO_SHELL_ROUTES: Routes = [
  {
    path: '',
    component: StudioShellLayoutComponent,
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
      PraxisThemeService,
      { provide: API_URL, useValue: { default: { baseUrl: '' } } satisfies ApiUrlConfig },
      DomainRuleService,
      ResourceDiscoveryService,
      ProjectionCatalogService,
      AccessReleaseService,
      CatalogSelectionStore,
      StudioCatalogBootstrapService
    ],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'catalog' },
      {
        path: 'overview',
        loadChildren: () => import('../features/overview/overview.routes')
          .then(module => module.OVERVIEW_ROUTES)
      },
      {
        path: 'catalog',
        loadChildren: () => import('../features/catalog/catalog.routes')
          .then(module => module.CATALOG_ROUTES)
      },
      {
        path: 'reviews',
        loadChildren: () => import('../features/reviews/reviews.routes')
          .then(module => module.REVIEWS_ROUTES)
      },
      {
        path: 'access',
        loadChildren: () => import('../features/access/access.routes')
          .then(module => module.ACCESS_ROUTES)
      },
      { path: '**', redirectTo: 'catalog' }
    ]
  }
];
