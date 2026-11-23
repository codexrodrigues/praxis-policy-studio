import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./shell/studio-shell.routes')
      .then(module => module.STUDIO_SHELL_ROUTES)
  }
];
