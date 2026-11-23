import { Routes } from '@angular/router';
import { OverviewPageComponent } from './overview-page.component';

export const OVERVIEW_ROUTES: Routes = [
  {
    path: '',
    component: OverviewPageComponent,
    data: { titleKey: 'pageTitleOverview' }
  }
];
