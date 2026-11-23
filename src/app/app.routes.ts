import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'catalog' },
  {
    path: 'catalog',
    loadChildren: () => import('./features/catalog/catalog.routes')
      .then(module => module.CATALOG_ROUTES)
  },
  { path: '**', redirectTo: 'catalog' }
];
