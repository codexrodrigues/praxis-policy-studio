import { Routes } from '@angular/router';
import { CatalogWorkspaceComponent } from './features/catalog/catalog-workspace.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'catalog' },
  { path: 'catalog', component: CatalogWorkspaceComponent, title: 'Catálogo — Praxis Policy Studio' },
  { path: '**', redirectTo: 'catalog' }
];

