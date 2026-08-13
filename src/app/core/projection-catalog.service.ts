import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { SupportedLocale } from './runtime-config';
import { validateDomainProjection } from './domain-projection';
import { DecisionSummary } from '../features/catalog/catalog.fixture';

@Injectable({ providedIn: 'root' })
export class ProjectionCatalogService {
  private readonly http = inject(HttpClient);

  load(path: string, locale: SupportedLocale): Observable<readonly DecisionSummary[]> {
    return this.http.get<unknown>(path).pipe(
      map(validateDomainProjection),
      map(projection => projection.decisionRefs.map(decision => ({
        key: decision.decisionKey,
        code: decision.reasonCode,
        name: decision.presentationLabel,
        domain: projection.presentationLabels.domain[locale] ?? projection.ruleSetRef.boundedContextKey,
        ruleSet: projection.presentationLabels.ruleSet[locale] ?? projection.ruleSetRef.ruleSetKey,
        state: decision.semanticStatus === 'TECHNICAL_DRAFT_READY' ? 'technical-draft' as const : 'verified' as const,
        meaning: decision.presentationLabel,
        authority: `${projection.authorityEvidence.currentAuthority} · ${projection.authorityEvidence.legacyAuthority}`,
        source: decision.semanticSourceRef,
        evidenceCount: projection.sourceArtifacts.length,
        editable: decision.editable,
        reviewStatus: decision.reviewStatus
      })))
    );
  }
}

