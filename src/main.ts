import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig).catch((error: unknown) => {
  document.body.dataset['bootstrapError'] = 'true';
  console.error('Policy Studio bootstrap failed', error);
});

