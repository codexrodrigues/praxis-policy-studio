import { Routes } from '@angular/router';
import { CatalogWorkspaceComponent } from './catalog-workspace.component';
import { ScenarioSandboxFacade } from './scenario-sandbox.facade';
import { SnapshotExecutionFacade } from './snapshot-execution.facade';
import { WorkspaceAuthoringFacade } from './workspace-authoring.facade';

export const CATALOG_ROUTES: Routes = [
  {
    path: '',
    component: CatalogWorkspaceComponent,
    data: { titleKey: 'pageTitleCatalog' },
    canDeactivate: [(component: CatalogWorkspaceComponent) => component.confirmRouteLeave()],
    providers: [
      SnapshotExecutionFacade,
      ScenarioSandboxFacade,
      WorkspaceAuthoringFacade
    ]
  }
];
