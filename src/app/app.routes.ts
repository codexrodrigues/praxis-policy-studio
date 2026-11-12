import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'catalog' },
  {
    path: 'catalog',
    loadComponent: () => import('./features/catalog/catalog-workspace.component')
      .then(module => module.CatalogWorkspaceComponent),
    title: 'Catálogo — Praxis Rules Studio'
  },
  { path: '**', redirectTo: 'catalog' }
];
