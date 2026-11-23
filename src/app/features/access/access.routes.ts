import { Routes } from '@angular/router';
import { AccessPageComponent } from './access-page.component';

export const ACCESS_ROUTES: Routes = [
  {
    path: '',
    component: AccessPageComponent,
    data: { titleKey: 'pageTitleAccess' }
  }
];
