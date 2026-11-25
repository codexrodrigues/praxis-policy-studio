import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  catchError,
  EMPTY,
  expand,
  forkJoin,
  from,
  map,
  mergeMap,
  Observable,
  of,
  reduce,
  retry,
  switchMap,
  tap,
  throwError,
  timer,
  toArray
} from 'rxjs';
import { PolicyStudioRuntimeConfig, SupportedLocale } from './runtime-config';
import { AuthSessionService } from './auth-session.service';
import { AUTHORIZATION_RULE_TYPE } from './prepared-access-draft';
import { createClientRequestId } from './client-request-id';
import { DomainProjection, validateDomainProjection } from './domain-projection';
import {
  type DecisionFactAllowedValue,
  type DecisionFactConstraints,
  type DecisionFactGovernance,
  type DecisionFactLineage,
  type DecisionFactOptionSourceRef,
  DecisionLegacyOccurrence,
  DecisionLifecycleSummary,
  DecisionParameterCatalog,
  DecisionParameterDescriptor,
  DecisionParameterValueType,
  DecisionPublicationResult,
  DecisionStageId,
  DecisionSummary,
  DecisionTimelineEvent,
  PolicySandboxRun,
  PublicationReadiness,
  RuleSetCompositionCandidate,
  RuleSetCompositionCandidateCommand,
  RuleSetCompositionCandidateRequest,
  RuleSetCompositionPublication,
  SlotOverridePolicyId
} from '../features/catalog/catalog.fixture';
import { collectFactPaths, formatDecisionExpression } from './decision-inspection';
import { isParameterFactPath } from './fact-presentation';
import {
  DOMAIN_RULE_DOCUMENTATION_KEY,
  extractRuleDocumentation,
  type RuleDocumentationDescriptor
} from './rule-documentation';
import {
  DomainRuleService,
  ResourceDiscoveryService,
  type ResourceActionCatalogItem,
  type RestApiResponse,
  type DomainRuleChangeWorkspace,
  type DomainRuleChangeWorkspaceUpdateRequest,
  type DomainRuleCatalogCandidate,
  type DomainRuleCatalogPage,
  type DomainRuleCompositionApproval,
  type DomainRuleCompositionManifest,
  type DomainRuleDefinition,
  type DomainRuleDefinitionCapabilities,
  type DomainRuleDefinitionRequest,
  type DomainRuleRequestOptions,
  type DomainRuleSnapshotActivation,
  type DomainRuleSnapshotStored,
  type DomainRuleSnapshotCompositionRequest,
  type DomainRuleSnapshotPublicationRequest,
  type DomainRuleExecutionSummary,
  type DomainRuleFactCatalog,
  type DomainRuleParameterCatalog,
  type DomainRuleParameterDescriptor,
  type DomainRuleHostStatusSummary,
  type DomainRuleRolloutPolicy,
  type DomainRuleRolloutPolicyCatalog,
  type DomainRuleRolloutPolicyCreateRequest,
  type DomainRuleRolloutPolicyEvent,
  type DomainRuleRolloutPolicyMutation,
  type DomainRuleRollout,
  type DomainRuleRolloutCatalog,
  type DomainRuleRolloutCatalogItem,
  type DomainRuleSnapshotHeadSetResponse,
  type DomainRuleSnapshotHeadStatus,
  type DomainRuleSnapshotVersion,
  type DomainRuleSnapshotWithdrawalRequest,
  type DomainRuleSnapshotWithdrawalResponse,
  type DomainRuleTestScenario,
  type DomainRuleTestScenarioRequest,
  type DomainRuleTestRun,
  type DomainRuleWorkspaceCapabilities
} from '@praxisui/core';

export interface CatalogSummaryBucketCount {
  readonly key: string;
  readonly count: number;
}

export interface CatalogWorkspaceQueueSummary {
  readonly openDrafts: number;
  readonly inReview: number;
  readonly approved: number;
  readonly rejected: number;
  readonly promoted: number;
  readonly totalPending: number;
}

export interface DomainRuleCatalogSummary {
  readonly schemaVersion: string;
  readonly totalDefinitions: number;
  readonly totalBusinessRules: number;
  readonly totalAuthorizationPolicies: number;
  readonly byContextKey: readonly CatalogSummaryBucketCount[];
  readonly byResourceKey: readonly CatalogSummaryBucketCount[];
  readonly byRuleType: readonly CatalogSummaryBucketCount[];
  readonly byDefinitionStatus: readonly CatalogSummaryBucketCount[];
  readonly reviewQueue: CatalogWorkspaceQueueSummary;
}

export interface ExtendedCatalogCandidate extends DomainRuleCatalogCandidate {
  readonly displayName?: string | null;
  readonly domainLabel?: string | null;
  readonly ruleSetLabel?: string | null;
}

export interface AccessCatalogPage {
  readonly candidates: readonly ExtendedCatalogCandidate[];
  readonly page: number;
  readonly limit: number;
  readonly hasMore: boolean;
  readonly totalElements: number | null;
  readonly truncated: boolean;
}

interface ExtendedCatalogPage extends DomainRuleCatalogPage {
  readonly candidates: ExtendedCatalogCandidate[];
  readonly totalElements?: number | null;
  readonly totalPages?: number | null;
  readonly truncated?: boolean | null;
}

type CatalogPageFetchOutcome =
  | { readonly ok: true; readonly page: ExtendedCatalogPage }
  | { readonly ok: false; readonly pageNumber: number; readonly error: unknown };

export interface ProgressiveCatalogChunk {
  readonly decisions: readonly DecisionSummary[];
  readonly complete: boolean;
  readonly totalKnown: number | null;
  readonly truncated?: boolean;
  readonly partialError?: string | null;
  readonly supportsServerSummary?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProjectionCatalogService {
  private static readonly CATALOG_PAGE_LIMIT = 12;
  private static readonly WORKSTATION_PAGE_LIMIT = 100;
  private static readonly PROGRESSIVE_BATCH_SIZE = 6;
  private static readonly MAX_CATALOG_PAGE = 100;
  private static readonly MAX_WORKSTATION_PAGE = 500;
  transientRetryDelayMs = 150;

  private readonly http = inject(HttpClient);
  private readonly domainRules = inject(DomainRuleService);
  private readonly discovery = inject(ResourceDiscoveryService);
  private readonly authSession = inject(AuthSessionService);
  private cachedCatalogMeta: {
    readonly baseUrl: string;
    readonly workspaces: readonly DomainRuleChangeWorkspace[];
    readonly definitionCapabilities: DomainRuleDefinitionCapabilities;
  } | null = null;

  invalidateCatalogMetaCache(): void {
    this.cachedCatalogMeta = null;
  }

  load(locale: SupportedLocale, config: PolicyStudioRuntimeConfig): Observable<readonly DecisionSummary[]> {
    this.invalidateCatalogMetaCache();
    const catalog = config.mode === 'remote'
      ? this.loadCatalogPages(config)
      : of([] as readonly DomainRuleCatalogCandidate[]);
    const workspaces = config.mode === 'remote'
      ? this.domainRules.listChangeWorkspaces(this.requestOptions(config))
      : of([] as readonly DomainRuleChangeWorkspace[]);
    const definitionCapabilities = config.mode === 'remote'
      ? this.domainRules.getDefinitionCapabilities(this.requestOptions(config))
      : of({ tenantId: '', environment: '', definitions: [] } satisfies DomainRuleDefinitionCapabilities);
    return forkJoin({
      projection: this.loadProjection(config),
      catalog,
      definitionCapabilities,
      workspaces
    }).pipe(
      switchMap(({ projection, catalog, definitionCapabilities, workspaces }) => {
        if (config.mode === 'fixture') {
          return of(this.fixtureSummaries(projection!, locale));
        }
        const baseUrl = (config.configApiBaseUrl ?? '').replace(/\/$/, '');
        this.cachedCatalogMeta = { baseUrl, workspaces, definitionCapabilities };
        const deepLinkCtx = this.resolveRequestedDeepLinkContext(config, workspaces);
        const eagerCandidates = this.selectEagerCandidates(catalog, projection, deepLinkCtx, catalog.length <= 12);
        return this.hydrateAndBuildSummaries({
          projection,
          allCandidates: catalog,
          candidatesToHydrate: eagerCandidates,
          hydratedByKey: new Map(),
          ruleSetMetaByResourceKey: new Map(),
          workspaces,
          definitionCapabilities,
          locale,
          config
        }).pipe(map(result => result.summaries));
      })
    );
  }

  /** Streams page 0 immediately and then fetches remaining catalog pages in bounded batches. */
  loadProgressive(locale: SupportedLocale, config: PolicyStudioRuntimeConfig): Observable<ProgressiveCatalogChunk> {
    if (config.mode === 'fixture') {
      return this.load(locale, config).pipe(
        map(decisions => ({ decisions, complete: true, totalKnown: decisions.length }))
      );
    }
    this.invalidateCatalogMetaCache();
    const options = this.requestOptions(config);
    return forkJoin({
      projection: this.loadProjection(config),
      page0: this.domainRules.browseDefinitionCatalog({ page: 0, limit: ProjectionCatalogService.CATALOG_PAGE_LIMIT }, options),
      definitionCapabilities: this.domainRules.getDefinitionCapabilities(options),
      workspaces: this.domainRules.listChangeWorkspaces(options)
    }).pipe(
      switchMap(({ projection, page0, definitionCapabilities, workspaces }) => {
        const baseUrl = (config.configApiBaseUrl ?? '').replace(/\/$/, '');
        this.cachedCatalogMeta = { baseUrl, workspaces, definitionCapabilities };
        const page0Ext = page0 as ExtendedCatalogPage;
        const serverTotalElements = typeof page0Ext.totalElements === 'number' ? page0Ext.totalElements : null;
        const serverTotalPages = typeof page0Ext.totalPages === 'number' ? page0Ext.totalPages : null;
        const supportsWorkstationPaging = serverTotalElements !== null && serverTotalPages !== null;
        const deepLinkCtx = this.resolveRequestedDeepLinkContext(config, workspaces);
        const hydratedByKey = new Map<string, DecisionSummary>();
        const ruleSetMetaByResourceKey = new Map<string, {
          ruleSetKey: string;
          resourceKey: string | null;
          availableRoots: readonly string[];
          conceptRoots: readonly string[];
        }>();
        const page0Candidates = this.latestCatalogCandidates(
          page0.candidates.filter(candidate => candidate.ruleType !== AUTHORIZATION_RULE_TYPE)
        );
        const isSmallCatalog = !page0.hasMore && page0Candidates.length <= ProjectionCatalogService.CATALOG_PAGE_LIMIT;
        const page0Eager = this.selectEagerCandidates(page0Candidates, projection, deepLinkCtx, isSmallCatalog);

        const nextLimit = supportsWorkstationPaging
          ? ProjectionCatalogService.WORKSTATION_PAGE_LIMIT
          : ProjectionCatalogService.CATALOG_PAGE_LIMIT;
        const maxPage = supportsWorkstationPaging
          ? ProjectionCatalogService.MAX_WORKSTATION_PAGE
          : ProjectionCatalogService.MAX_CATALOG_PAGE;
        const knownTotalPages = supportsWorkstationPaging
          ? Math.min(
              Math.max(1, Math.ceil(serverTotalElements / ProjectionCatalogService.WORKSTATION_PAGE_LIMIT)),
              ProjectionCatalogService.MAX_WORKSTATION_PAGE + 1
            )
          : null;
        const initialBatchSize = supportsWorkstationPaging
          ? ProjectionCatalogService.PROGRESSIVE_BATCH_SIZE
          : page0.candidates.length >= ProjectionCatalogService.CATALOG_PAGE_LIMIT
            ? ProjectionCatalogService.PROGRESSIVE_BATCH_SIZE
            : 1;
        const hasMoreAfterPage0 = page0.hasMore && (supportsWorkstationPaging || page0.page < maxPage);
        const initialTruncated = supportsWorkstationPaging
          ? Math.ceil(serverTotalElements / ProjectionCatalogService.WORKSTATION_PAGE_LIMIT) >
              ProjectionCatalogService.MAX_WORKSTATION_PAGE + 1
          : Boolean(page0Ext.truncated) || (page0.hasMore && page0.page >= maxPage);

        const initial$ = this.hydrateAndBuildSummaries({
          projection,
          allCandidates: page0Candidates,
          candidatesToHydrate: page0Eager,
          hydratedByKey,
          ruleSetMetaByResourceKey,
          workspaces,
          definitionCapabilities,
          locale,
          config
        }).pipe(
          map(({ summaries }) => ({
            allCandidates: page0Candidates,
            nextPage: supportsWorkstationPaging ? 0 : page0.page + 1,
            limit: nextLimit,
            maxPage,
            knownTotalPages,
            serverTotalElements,
            batchSize: initialBatchSize,
            hasMore: hasMoreAfterPage0,
            chunk: {
              decisions: summaries,
              complete: !hasMoreAfterPage0,
              totalKnown: !hasMoreAfterPage0 ? summaries.length : serverTotalElements,
              truncated: initialTruncated,
              partialError: null,
              supportsServerSummary: supportsWorkstationPaging
            } satisfies ProgressiveCatalogChunk
          }))
        );
        return initial$.pipe(
          expand(state => {
            if (!state.hasMore) return EMPTY;
            return this.fetchNextCatalogBatch(
              state.nextPage,
              state.limit,
              state.maxPage,
              state.knownTotalPages,
              options,
              state.batchSize
            ).pipe(
              switchMap(({ batchCandidates, nextPage, reachedEnd, partialError, hitMaxCeiling }) => {
                const newCandidates = batchCandidates.filter(
                  candidate => candidate.ruleType !== AUTHORIZATION_RULE_TYPE
                );
                const mergedCandidates = this.latestCatalogCandidates([...state.allCandidates, ...newCandidates]);
                const mergedByKey = new Map(mergedCandidates.map(candidate => [candidate.ruleKey, candidate]));
                const unhydratedNew = newCandidates.filter(candidate => {
                  const latestForKey = mergedByKey.get(candidate.ruleKey);
                  if (!latestForKey || latestForKey.definitionId !== candidate.definitionId) return false;
                  const prev = hydratedByKey.get(candidate.ruleKey);
                  return !(prev?.detailHydrated && prev.configDefinitionId === candidate.definitionId);
                });
                const candidatesToHydrate = this.selectIncrementalHydrationCandidates(
                  unhydratedNew,
                  hydratedByKey,
                  deepLinkCtx
                );
                const chunkTruncated = state.chunk.truncated || hitMaxCeiling;
                return this.hydrateAndBuildSummaries({
                  projection,
                  allCandidates: mergedCandidates,
                  candidatesToHydrate,
                  hydratedByKey,
                  ruleSetMetaByResourceKey,
                  workspaces,
                  definitionCapabilities,
                  locale,
                  config
                }).pipe(
                  map(({ summaries }) => ({
                    ...state,
                    allCandidates: mergedCandidates,
                    nextPage,
                    hasMore: !reachedEnd,
                    chunk: {
                      decisions: summaries,
                      complete: reachedEnd,
                      totalKnown: reachedEnd && !partialError ? summaries.length : state.serverTotalElements,
                      truncated: chunkTruncated,
                      partialError,
                      supportsServerSummary: supportsWorkstationPaging
                    } satisfies ProgressiveCatalogChunk
                  }))
                );
              })
            );
          }),
          map(state => state.chunk)
        );
      })
    );
  }

  /** Fetches server-computed portfolio counts when supported by the backend host. */
  loadCatalogSummary(config: PolicyStudioRuntimeConfig): Observable<DomainRuleCatalogSummary | null> {
    if (config.mode !== 'remote') return of(null);
    const baseUrl = (config.configApiBaseUrl ?? '').replace(/\/$/, '');
    return this.http.get<DomainRuleCatalogSummary>(
      `${baseUrl}/api/praxis/config/domain-rules/definitions/catalog/summary`,
      { withCredentials: true }
    ).pipe(
      catchError(error => (
        error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)
          ? throwError(() => error)
          : of(null)
      ))
    );
  }

  /** Hydrates sibling definitions in the same RuleSet in one resource-scoped query for instant DAG rendering. */
  hydrateRuleSetSiblings(
    resourceKey: string,
    siblings: readonly DecisionSummary[],
    totalDecisions: number,
    locale: SupportedLocale,
    config: PolicyStudioRuntimeConfig
  ): Observable<readonly DecisionSummary[]> {
    if (config.mode !== 'remote' || !siblings.length) return of([]);
    const trimmedResource = resourceKey.trim();
    const options = this.requestOptions(config);
    const baseUrl = (config.configApiBaseUrl ?? '').replace(/\/$/, '');
    const cached = this.cachedCatalogMeta?.baseUrl === baseUrl ? this.cachedCatalogMeta : null;
    const siblingByKey = new Map(siblings.map(item => [item.key, item]));

    const fallbackBounded = (missing: readonly DecisionSummary[]): Observable<readonly DecisionSummary[]> =>
      missing.length
        ? from(missing).pipe(
            mergeMap(sibling => this.loadDiscoveredCandidate(
              {
                definitionId: sibling.configDefinitionId!,
                ruleKey: sibling.key,
                version: sibling.configVersion!,
                status: sibling.configStatus ?? 'draft',
                ruleType: sibling.ruleType ?? 'validation',
                contextKey: sibling.domain,
                resourceKey: sibling.ruleSetKey || sibling.resourceKey,
                serviceKey: sibling.serviceKey,
                semanticOwner: null,
                updatedAt: ''
              },
              Math.max(0, sibling.order - 1),
              totalDecisions,
              locale,
              config
            ).pipe(catchError(() => EMPTY)), 4),
            toArray()
          )
        : of([]);

    if (!trimmedResource) {
      return fallbackBounded(siblings);
    }

    return this.domainRules.listDefinitions({ resourceKey: trimmedResource }, options).pipe(
      switchMap(definitions => {
        const latestByRuleKey = new Map<string, DomainRuleDefinition>();
        for (const def of definitions) {
          if (def.ruleType === AUTHORIZATION_RULE_TYPE || !siblingByKey.has(def.ruleKey)) continue;
          const prev = latestByRuleKey.get(def.ruleKey);
          const expectedId = siblingByKey.get(def.ruleKey)?.configDefinitionId;
          if (!prev || def.id === expectedId || (prev.id !== expectedId && (def.version ?? 0) > (prev.version ?? 0))) {
            latestByRuleKey.set(def.ruleKey, def);
          }
        }
        const resolved: DecisionSummary[] = [];
        const missing: DecisionSummary[] = [];
        for (const sibling of siblings) {
          const def = latestByRuleKey.get(sibling.key);
          if (!def) {
            missing.push(sibling);
            continue;
          }
          const workspace = cached ? this.latestWorkspace(cached.workspaces, sibling.key) : undefined;
          const actions = cached
            ? this.mergeDefinitionActions(
                cached.definitionCapabilities,
                def.id,
                sibling.key,
                def.version ?? sibling.configVersion ?? null,
                workspace?.promotedDefinitionId ?? null
              )
            : sibling.availableDefinitionActions;
          const candidate: ExtendedCatalogCandidate = {
            definitionId: def.id,
            ruleKey: def.ruleKey,
            version: def.version ?? sibling.configVersion ?? 1,
            ruleType: def.ruleType ?? sibling.ruleType ?? 'validation',
            status: def.status ?? sibling.configStatus ?? 'draft',
            contextKey: def.contextKey ?? sibling.domain,
            resourceKey: def.resourceKey ?? sibling.resourceKey,
            serviceKey: def.serviceKey ?? sibling.serviceKey,
            semanticOwner: def.semanticOwner ?? null,
            updatedAt: def.updatedAt ?? '',
            displayName: sibling.name,
            domainLabel: sibling.domainLabel ?? null,
            ruleSetLabel: sibling.ruleSetLabel ?? null
          };
          const built = this.catalogSummary(
            candidate,
            Math.max(0, sibling.order - 1),
            totalDecisions,
            locale,
            actions,
            undefined,
            def,
            workspace,
            null
          );
          resolved.push({
            ...built,
            detailHydrated: false
          });
        }
        if (!missing.length) {
          return of(resolved);
        }
        return fallbackBounded(missing).pipe(
          map(extra => [...resolved, ...extra])
        );
      }),
      catchError(() => fallbackBounded(siblings))
    );
  }

  /** Lists authorization definitions with pagination and server-side search, degrading gracefully on older hosts. */
  browseAccessCatalog(
    config: PolicyStudioRuntimeConfig,
    params?: {
      readonly page?: number;
      readonly limit?: number;
      readonly query?: string | null;
      readonly status?: string | null;
      readonly resourceKey?: string | null;
    }
  ): Observable<AccessCatalogPage> {
    if (config.mode !== 'remote') {
      return of({ candidates: [], page: 0, limit: 25, hasMore: false, totalElements: 0, truncated: false });
    }
    const page = params?.page ?? 0;
    const requestedLimit = params?.limit ?? 25;
    const options = this.requestOptions(config);
    const query = params?.query?.trim() || undefined;
    const status = params?.status?.trim() || undefined;
    const resourceKey = params?.resourceKey?.trim() || undefined;

    const toAccessPage = (res: DomainRuleCatalogPage): AccessCatalogPage => {
      const ext = res as ExtendedCatalogPage;
      const filtered = (ext.candidates ?? []).filter(item => item.ruleType === AUTHORIZATION_RULE_TYPE);
      return {
        candidates: filtered,
        page: ext.page ?? page,
        limit: ext.limit ?? requestedLimit,
        hasMore: Boolean(ext.hasMore),
        totalElements: typeof ext.totalElements === 'number' ? ext.totalElements : null,
        truncated: Boolean(ext.truncated)
      };
    };

    const callCatalog = (limit: number): Observable<AccessCatalogPage> =>
      this.domainRules.browseDefinitionCatalog(
        {
          page,
          limit,
          ruleType: AUTHORIZATION_RULE_TYPE,
          ...(query ? { query } : {}),
          ...(status ? { status: status as DomainRuleCatalogCandidate['status'] } : {}),
          ...(resourceKey ? { resourceKey } : {})
        },
        options
      ).pipe(map(toAccessPage));

    const fallbackToList = (error: unknown): Observable<AccessCatalogPage> => {
      if (error instanceof HttpErrorResponse && (error.status === 404 || error.status === 405)) {
        return this.listAccessDefinitions(config).pipe(
          map(items => {
            const matched = items.filter(item => {
              if (status && item.status !== status) return false;
              if (resourceKey && item.resourceKey !== resourceKey) return false;
              if (query) {
                const needle = query.toLowerCase();
                return `${item.ruleKey} ${item.resourceKey ?? ''} ${item.serviceKey ?? ''}`.toLowerCase().includes(needle);
              }
              return true;
            });
            const candidates: ExtendedCatalogCandidate[] = matched.map(item => ({
              definitionId: item.id,
              ruleKey: item.ruleKey,
              version: item.version ?? 1,
              ruleType: item.ruleType ?? AUTHORIZATION_RULE_TYPE,
              status: item.status ?? 'draft',
              contextKey: item.contextKey ?? null,
              resourceKey: item.resourceKey ?? null,
              serviceKey: item.serviceKey ?? null,
              semanticOwner: item.semanticOwner ?? null,
              updatedAt: item.updatedAt ?? ''
            }));
            return {
              candidates,
              page: 0,
              limit: Math.max(candidates.length, 1),
              hasMore: false,
              totalElements: candidates.length,
              truncated: false
            };
          })
        );
      }
      return throwError(() => error);
    };

    return callCatalog(requestedLimit).pipe(
      catchError((error: unknown) => {
        if (
          error instanceof HttpErrorResponse
          && (error.status === 400 || error.status === 500)
          && requestedLimit > ProjectionCatalogService.CATALOG_PAGE_LIMIT
        ) {
          return callCatalog(ProjectionCatalogService.CATALOG_PAGE_LIMIT).pipe(
            catchError(fallbackToList)
          );
        }
        return fallbackToList(error);
      })
    );
  }

  /** Lists authorization definitions for assisted /access discovery. */
  listAccessDefinitions(config: PolicyStudioRuntimeConfig): Observable<readonly DomainRuleDefinition[]> {
    if (config.mode !== 'remote') return of([]);
    return this.domainRules.listDefinitions({ ruleType: AUTHORIZATION_RULE_TYPE }, this.requestOptions(config)).pipe(
      map(items => items.filter(item => item.ruleType === AUTHORIZATION_RULE_TYPE))
    );
  }

  private loadProjection(config: PolicyStudioRuntimeConfig): Observable<DomainProjection | null> {
    return config.projectionPath
      ? this.http.get<unknown>(config.projectionPath).pipe(
          map(validateDomainProjection),
          catchError(error => config.mode === 'remote' ? of(null) : throwError(() => error)))
      : of(null);
  }

  private fetchNextCatalogBatch(
    startPage: number,
    limit: number,
    maxPage: number,
    knownTotalPages: number | null,
    options: DomainRuleRequestOptions,
    batchSize: number = ProjectionCatalogService.PROGRESSIVE_BATCH_SIZE
  ): Observable<{
    readonly batchCandidates: readonly DomainRuleCatalogCandidate[];
    readonly nextPage: number;
    readonly reachedEnd: boolean;
    readonly partialError: string | null;
    readonly hitMaxCeiling: boolean;
  }> {
    const batchPages = Array.from(
      { length: batchSize },
      (_, offset) => startPage + offset
    ).filter(pageNum => pageNum <= maxPage && (knownTotalPages === null || pageNum < knownTotalPages));
    if (!batchPages.length) {
      return of({
        batchCandidates: [],
        nextPage: startPage,
        reachedEnd: true,
        partialError: null,
        hitMaxCeiling: knownTotalPages === null && startPage > maxPage
      });
    }
    return forkJoin(
      batchPages.map(pageNum => this.fetchCatalogPageWithOutcome(pageNum, limit, options, true))
    ).pipe(
      map(outcomes => {
        const okPages = outcomes
          .filter((item): item is Extract<CatalogPageFetchOutcome, { ok: true }> => item.ok)
          .map(item => item.page);
        const partialError = outcomes.some(item => !item.ok) ? 'CATALOG_PARTIAL_LOAD' : null;
        const lastBatchPage = batchPages[batchPages.length - 1] ?? startPage;
        const lastReturnedPage = okPages[okPages.length - 1];
        const hitLegacyCeiling = knownTotalPages === null
          && !partialError
          && lastBatchPage >= maxPage
          && okPages.some(page => page.hasMore);
        const hitServerCeiling = okPages.some(page => Boolean(page.truncated) && limit >= ProjectionCatalogService.WORKSTATION_PAGE_LIMIT);
        const reachedEnd = Boolean(partialError)
          || okPages.some(page => !page.hasMore || page.candidates.length === 0)
          || lastBatchPage >= maxPage
          || (knownTotalPages !== null && lastBatchPage + 1 >= knownTotalPages);
        return {
          batchCandidates: okPages.flatMap(page => page.candidates),
          nextPage: (lastReturnedPage?.page ?? lastBatchPage) + 1,
          reachedEnd,
          partialError,
          hitMaxCeiling: hitLegacyCeiling || hitServerCeiling
        };
      })
    );
  }

  private fetchCatalogPageSafely(
    page: number,
    options: DomainRuleRequestOptions,
    limit: number = ProjectionCatalogService.CATALOG_PAGE_LIMIT
  ): Observable<DomainRuleCatalogPage> {
    return this.fetchCatalogPageWithOutcome(page, limit, options, false).pipe(
      map(outcome => {
        if (!outcome.ok) throw outcome.error;
        return outcome.page;
      })
    );
  }

  private fetchCatalogPageWithOutcome(
    page: number,
    limit: number,
    options: DomainRuleRequestOptions,
    allowPartialFailure: boolean
  ): Observable<CatalogPageFetchOutcome> {
    return this.domainRules.browseDefinitionCatalog({ page, limit }, options).pipe(
      retry({
        count: 2,
        delay: (error: unknown) => (
          this.isTransientCatalogError(error)
            ? timer(this.transientRetryDelayMs)
            : throwError(() => error)
        )
      }),
      map(result => ({ ok: true as const, page: result as ExtendedCatalogPage })),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 400 && page > 0) {
          return of({
            ok: true as const,
            page: {
              schemaVersion: 'praxis-domain-rule-catalog.v1',
              candidates: [],
              page,
              limit,
              hasMore: false
            } satisfies ExtendedCatalogPage
          });
        }
        if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
          return throwError(() => error);
        }
        if (allowPartialFailure) {
          return of({ ok: false as const, pageNumber: page, error });
        }
        return throwError(() => error);
      })
    );
  }

  private isTransientCatalogError(error: unknown): boolean {
    return error instanceof HttpErrorResponse
      && (error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504);
  }

  private resolveRequestedDeepLinkContext(
    config: PolicyStudioRuntimeConfig,
    workspaces: readonly DomainRuleChangeWorkspace[]
  ) {
    const searchParams = typeof window !== 'undefined' && window.location?.search
      ? new URLSearchParams(window.location.search)
      : null;
    const requestedDecisionKey = searchParams?.get('decisionKey')?.trim() || null;
    const requestedBindingKey = searchParams?.get('bindingKey')?.trim() || null;
    const requestedSlotKey = searchParams?.get('slotKey')?.trim() || null;
    const requestedRuleSetKey = searchParams?.get('ruleSetKey')?.trim() || null;
    const requestedResourceKey = searchParams?.get('resourceKey')?.trim() || null;
    const hasRequestedDeepLink = Boolean(
      requestedDecisionKey || requestedBindingKey || requestedSlotKey || requestedRuleSetKey || requestedResourceKey
    );
    const eagerRuleKeys = new Set<string>([
      ...(config.initialDecisionKey ? [config.initialDecisionKey] : []),
      ...(requestedDecisionKey ? [requestedDecisionKey] : []),
      ...(requestedBindingKey ? [requestedBindingKey] : []),
      ...(requestedSlotKey ? [requestedSlotKey] : []),
      ...workspaces.map(item => item.ruleKey)
    ]);
    const matchesRequestedDeepLink = (
      candidate: DomainRuleCatalogCandidate,
      projection?: DomainProjection | null
    ): boolean =>
      eagerRuleKeys.has(candidate.ruleKey)
      || (!!projection && projection.decisionRefs.some(item => item.decisionKey === candidate.ruleKey))
      || (!!requestedSlotKey && candidate.ruleKey.startsWith(`${requestedSlotKey}.`))
      || (!!requestedRuleSetKey && candidate.resourceKey === requestedRuleSetKey)
      || (!!requestedResourceKey && candidate.resourceKey === requestedResourceKey);
    return { hasRequestedDeepLink, matchesRequestedDeepLink };
  }

  private selectEagerCandidates(
    catalog: readonly DomainRuleCatalogCandidate[],
    projection: DomainProjection | null,
    deepLinkCtx: ReturnType<ProjectionCatalogService['resolveRequestedDeepLinkContext']>,
    isTotalCatalogSmall: boolean
  ): readonly DomainRuleCatalogCandidate[] {
    if (!catalog.length) return [];
    if (isTotalCatalogSmall) return catalog;
    const projectionMatchesCatalog = !!projection
      && catalog.some(candidate => projection.decisionRefs.some(ref => ref.decisionKey === candidate.ruleKey));
    if (projectionMatchesCatalog) {
      return catalog.filter(candidate => deepLinkCtx.matchesRequestedDeepLink(candidate, projection));
    }
    const deepLinkMatches = catalog.filter(candidate => deepLinkCtx.matchesRequestedDeepLink(candidate, projection));
    if (deepLinkMatches.length) {
      return deepLinkMatches.slice(0, 6);
    }
    const firstActive = catalog.find(candidate => candidate.status !== 'retired') ?? catalog[0];
    return firstActive ? [firstActive] : [];
  }

  private selectIncrementalHydrationCandidates(
    unhydratedBatchCandidates: readonly DomainRuleCatalogCandidate[],
    hydratedByKey: ReadonlyMap<string, DecisionSummary>,
    deepLinkCtx: ReturnType<ProjectionCatalogService['resolveRequestedDeepLinkContext']>
  ): readonly DomainRuleCatalogCandidate[] {
    if (!unhydratedBatchCandidates.length) return [];
    const hydratedCount = [...hydratedByKey.values()].filter(item => item.detailHydrated).length;
    const upgradedPrevious = unhydratedBatchCandidates.filter(candidate => hydratedByKey.get(candidate.ruleKey)?.detailHydrated);
    const deepLinkMatches = unhydratedBatchCandidates.filter(candidate => deepLinkCtx.matchesRequestedDeepLink(candidate, null));
    const combined = [...new Map([...upgradedPrevious, ...deepLinkMatches].map(c => [c.definitionId, c])).values()];
    if (combined.length) return combined.slice(0, 6);
    if (hydratedCount === 0) {
      const firstActive = unhydratedBatchCandidates.find(c => c.status !== 'retired') ?? unhydratedBatchCandidates[0];
      return firstActive ? [firstActive] : [];
    }
    return [];
  }

  private hydrateAndBuildSummaries(params: {
    readonly projection: DomainProjection | null;
    readonly allCandidates: readonly DomainRuleCatalogCandidate[];
    readonly candidatesToHydrate: readonly DomainRuleCatalogCandidate[];
    readonly hydratedByKey: Map<string, DecisionSummary>;
    readonly ruleSetMetaByResourceKey: Map<string, {
      ruleSetKey: string;
      resourceKey: string | null;
      availableRoots: readonly string[];
      conceptRoots: readonly string[];
    }>;
    readonly workspaces: readonly DomainRuleChangeWorkspace[];
    readonly definitionCapabilities: DomainRuleDefinitionCapabilities;
    readonly locale: SupportedLocale;
    readonly config: PolicyStudioRuntimeConfig;
  }): Observable<{ readonly summaries: readonly DecisionSummary[] }> {
    const {
      projection,
      allCandidates,
      candidatesToHydrate,
      hydratedByKey,
      ruleSetMetaByResourceKey,
      workspaces,
      definitionCapabilities,
      locale,
      config
    } = params;
    const detailRead$ = (candidate: DomainRuleCatalogCandidate) => forkJoin({
      definitionWithParameters: this.domainRules.getDefinition(candidate.definitionId, this.requestOptions(config)).pipe(
        switchMap(definition => (this.hasParameterTemplate(definition)
          ? this.fetchDefinitionParameters(candidate.definitionId, config)
          : of<DomainRuleParameterCatalog | null>(null)
        ).pipe(map(serverParameterCatalog => ({ definition, serverParameterCatalog }))))
      ),
      factCatalog: this.domainRules.getDefinitionFacts(candidate.definitionId, this.requestOptions(config))
    });
    return (candidatesToHydrate.length
      ? from(candidatesToHydrate).pipe(mergeMap(detailRead$, 6), toArray())
      : of([])
    ).pipe(map(definitionDetails => {
      const details = new Map(definitionDetails.map(detail => [detail.definitionWithParameters.definition.id, detail]));
      for (const detail of definitionDetails) {
        const def = detail.definitionWithParameters.definition;
        const rk = def.resourceKey?.trim();
        if (!rk || ruleSetMetaByResourceKey.has(rk)) continue;
        const defBody = this.record(def.definition);
        const paramsBody = this.record(def.parameters);
        const slotMeta = this.extractSlotPlanMetadata(defBody, undefined);
        ruleSetMetaByResourceKey.set(rk, {
          ruleSetKey: this.stringValue(defBody, 'ruleSetKey')
            ?? this.stringValue(paramsBody, 'ruleSetKey')
            ?? rk,
          resourceKey: this.stringValue(defBody, 'operationalResourceKey')
            ?? this.stringValue(paramsBody, 'operationalResourceKey')
            ?? rk,
          availableRoots: slotMeta.availableRoots ?? [],
          conceptRoots: slotMeta.conceptRoots ?? []
        });
      }
      const summaries = allCandidates.map((candidate, index) => {
        const detail = details.get(candidate.definitionId);
        const existingHydrated = hydratedByKey.get(candidate.ruleKey);
        if (!detail && existingHydrated?.detailHydrated && existingHydrated.configDefinitionId === candidate.definitionId) {
          return {
            ...existingHydrated,
            order: existingHydrated.order || index + 1,
            totalDecisions: projection ? projection.decisionRefs.length : allCandidates.length
          };
        }
        const built = this.mapCandidateToSummary(
          candidate,
          index,
          allCandidates.length,
          projection,
          detail,
          ruleSetMetaByResourceKey,
          workspaces,
          definitionCapabilities,
          locale
        );
        if (built.detailHydrated || !existingHydrated || existingHydrated.configDefinitionId !== candidate.definitionId) {
          hydratedByKey.set(candidate.ruleKey, built);
        }
        return built;
      });
      if (!projection) return { summaries };
      const projectionKeys = new Set(projection.decisionRefs.map(item => item.decisionKey));
      const governed = summaries
        .filter(item => projectionKeys.has(item.key))
        .sort((left, right) => left.order - right.order);
      const others = summaries.filter(item => !projectionKeys.has(item.key));
      return { summaries: [...governed, ...others] };
    }));
  }

  private mapCandidateToSummary(
    candidate: DomainRuleCatalogCandidate,
    index: number,
    totalCandidates: number,
    projection: DomainProjection | null,
    detail: {
      readonly definitionWithParameters: {
        readonly definition: DomainRuleDefinition;
        readonly serverParameterCatalog: DomainRuleParameterCatalog | null;
      };
      readonly factCatalog: DomainRuleFactCatalog;
    } | undefined,
    ruleSetMetaByResourceKey: ReadonlyMap<string, {
      ruleSetKey: string;
      resourceKey: string | null;
      availableRoots: readonly string[];
      conceptRoots: readonly string[];
    }>,
    workspaces: readonly DomainRuleChangeWorkspace[],
    definitionCapabilities: DomainRuleDefinitionCapabilities,
    locale: SupportedLocale
  ): DecisionSummary {
    const definition = detail?.definitionWithParameters.definition;
    const serverParameterCatalog = detail?.definitionWithParameters.serverParameterCatalog ?? null;
    const factCatalog = detail?.factCatalog ?? undefined;
    const decision = projection?.decisionRefs.find(item => item.decisionKey === candidate.ruleKey);
    const workspace = this.latestWorkspace(workspaces, candidate.ruleKey);
    const availableDefinitionActions = this.mergeDefinitionActions(
      definitionCapabilities,
      candidate.definitionId,
      candidate.ruleKey,
      candidate.version,
      workspace?.promotedDefinitionId ?? null
    );
    if (!projection || !decision) {
      const baseSummary = this.catalogSummary(candidate, index, totalCandidates, locale,
        availableDefinitionActions, factCatalog, definition, workspace, serverParameterCatalog);
      const siblingMeta = candidate.resourceKey?.trim()
        ? ruleSetMetaByResourceKey.get(candidate.resourceKey.trim())
        : undefined;
      if (!definition && siblingMeta) {
        return {
          ...baseSummary,
          ruleSetKey: siblingMeta.ruleSetKey,
          resourceKey: siblingMeta.resourceKey,
          ...(siblingMeta.availableRoots.length ? { availableRoots: siblingMeta.availableRoots } : {}),
          ...(siblingMeta.conceptRoots.length ? { conceptRoots: siblingMeta.conceptRoots } : {})
        };
      }
      return baseSummary;
    }
    const conditionFactPaths = collectFactPaths(definition?.condition);
    if (conditionFactPaths.some(factPath => !decision.factPaths.includes(factPath))) {
      throw new Error(`CONFIG_FACT_OUTSIDE_GOVERNED_PROJECTION ${decision.decisionKey}`);
    }
    const hasCatalogFacts = (factCatalog?.facts.length ?? 0) > 0;
    const facts = hasCatalogFacts
      ? this.decisionFacts(factCatalog, locale)
      : this.projectionFacts(decision.factPaths, projection.factSchemas);
    if (hasCatalogFacts && conditionFactPaths.some(factPath => !facts.some(fact => fact.path === factPath))) {
      throw new Error(`CONFIG_FACT_CATALOG_INCOMPLETE ${decision.decisionKey}`);
    }
    const parameterCatalog = this.overlayParameterCatalog(
      this.parameterCatalog(definition, serverParameterCatalog),
      workspace?.parameters
    );
    const definitionBody = this.record(definition?.definition);
    const slotPlanMeta = this.extractSlotPlanMetadata(definitionBody, decision);
    const executorKind = this.stringValue(definitionBody, 'executorKind');
    const isForbiddenSlot =
      slotPlanMeta.slotOverridePolicy === 'FORBIDDEN'
      || slotPlanMeta.slotOverridePolicy === 'LOCKED'
      || executorKind === 'JAVA'
      || executorKind === 'JAVA_EXECUTOR';
    const definitionDocumentation = this.resolveDefinitionDocumentation(definitionBody, decision);
    const hasWorkspaceDocField = !!workspace
      && Object.prototype.hasOwnProperty.call(workspace, DOMAIN_RULE_DOCUMENTATION_KEY)
      && (workspace as { documentation?: unknown }).documentation !== undefined;
    const workspaceDocumentation = workspace
      ? (hasWorkspaceDocField
          ? extractRuleDocumentation((workspace as { documentation?: unknown }).documentation)
          : definitionDocumentation)
      : null;
    const documentation = workspaceDocumentation ?? definitionDocumentation ?? null;
    const decisionKind = (definition?.ruleType ?? candidate.ruleType) === 'authorization_policy'
      ? 'AUTHORIZATION' as const
      : 'BUSINESS' as const;
    return {
      order: decision.order,
      totalDecisions: projection.decisionRefs.length,
      key: decision.decisionKey,
      code: decision.reasonCode ?? decision.decisionKey,
      name: decision.presentationLabel || documentation?.title || decision.decisionKey,
      domain: projection.presentationLabels.domain[locale] ?? projection.ruleSetRef.boundedContextKey,
      ruleSet: projection.presentationLabels.ruleSet[locale] ?? projection.ruleSetRef.ruleSetKey,
      ruleSetKey: projection.ruleSetRef.ruleSetKey,
      resourceKey: projection.ruleSetRef.operationalResourceKey?.trim() || null,
      serviceKey: definition?.serviceKey?.trim() || null,
      state: decision.semanticStatus === 'REFERENCE_IMPLEMENTED' ? 'verified' as const : 'technical-draft' as const,
      meaning: decision.presentationLabel || documentation?.summary || decision.decisionKey,
      authority: `${projection.authorityEvidence.currentAuthority} · ${projection.authorityEvidence.baselineAuthority}`,
      baselineAuthority: projection.authorityEvidence.baselineAuthority,
      source: decision.semanticSourceRef,
      evidenceCount: projection.sourceArtifacts.length,
      authoringSupported: !isForbiddenSlot && (decision.editable
        || (parameterCatalog?.parameters.length ?? 0) > 0
        || this.hasEditableOperationalPolicy(definition)),
      availableDefinitionActions,
      reviewStatus: decision.reviewStatus,
      configDefinitionId: candidate.definitionId,
      configVersion: candidate.version,
      configStatus: candidate.status,
      workspaceId: workspace?.id,
      workspaceStatus: workspace?.status,
      workspaceEtag: workspace?.etag,
      workspaceRevision: workspace?.revision,
      promotedDefinitionId: workspace?.promotedDefinitionId ?? null,
      workspaceCondition: workspace?.condition ?? null,
      workspaceParameters: workspace?.parameters ?? {},
      expression: formatDecisionExpression(definition?.condition),
      condition: definition?.condition ?? null,
      factPaths: conditionFactPaths.length ? conditionFactPaths : decision.factPaths,
      evaluatedFactPaths: (() => {
        const activePaths = collectFactPaths(workspace?.condition ?? definition?.condition)
          .filter(path => !isParameterFactPath(path));
        return activePaths.length ? activePaths : decision.factPaths;
      })(),
      facts,
      nullSemantics: this.stringValue(definition?.parameters, 'nullSemantics'),
      operationKeys: this.stringArrayValue(definition?.parameters, 'operationKeys') ?? projection.ruleSetRef.operationKeys,
      hostContractVersion: this.stringValue(definition?.parameters, 'hostContractVersion') ??
        projection.ruleSetRef.hostContractVersion ?? null,
      evidence: projection.sourceArtifacts,
      draftLifecycle: this.stringValue(definition?.governance, 'lifecycleBoundary'),
      ruleType: definition?.ruleType ?? candidate.ruleType,
      decisionKind,
      parameters: definition?.parameters ?? {},
      parameterCatalog,
      detailHydrated: definition !== undefined,
      documentation,
      definitionDocumentation,
      workspaceDocumentation,
      ...slotPlanMeta
    };
  }

  loadDiscoveredCandidate(
    candidate: DomainRuleCatalogCandidate,
    index: number,
    totalDecisions: number,
    locale: SupportedLocale,
    config: PolicyStudioRuntimeConfig
  ): Observable<DecisionSummary> {
    const options = this.requestOptions(config);
    const baseUrl = (config.configApiBaseUrl ?? '').replace(/\/$/, '');
    const cached = this.cachedCatalogMeta?.baseUrl === baseUrl ? this.cachedCatalogMeta : null;
    return forkJoin({
      definitionWithParameters: this.domainRules.getDefinition(candidate.definitionId, options).pipe(
        switchMap(definition => (this.hasParameterTemplate(definition)
          ? this.fetchDefinitionParameters(candidate.definitionId, config)
          : of<DomainRuleParameterCatalog | null>(null)
        ).pipe(map(serverParameterCatalog => ({ definition, serverParameterCatalog }))))
      ),
      factCatalog: this.domainRules.getDefinitionFacts(candidate.definitionId, options),
      workspaces: cached ? of(cached.workspaces) : this.domainRules.listChangeWorkspaces(options),
      definitionCapabilities: cached ? of(cached.definitionCapabilities) : this.domainRules.getDefinitionCapabilities(options)
    }).pipe(
      tap(({ workspaces, definitionCapabilities }) => {
        if (!cached) {
          this.cachedCatalogMeta = { baseUrl, workspaces, definitionCapabilities };
        }
      }),
      map(({ definitionWithParameters, factCatalog, workspaces, definitionCapabilities }) => {
        const { definition, serverParameterCatalog } = definitionWithParameters;
        if (definition.ruleType === AUTHORIZATION_RULE_TYPE) throw new Error('BUSINESS_DEFINITION_REQUIRED');
        const workspace = this.latestWorkspace(workspaces, candidate.ruleKey);
        const availableDefinitionActions = this.mergeDefinitionActions(
          definitionCapabilities,
          candidate.definitionId,
          candidate.ruleKey,
          candidate.version,
          workspace?.promotedDefinitionId ?? null
        );
        return this.catalogSummary(
          candidate,
          index,
          Math.max(totalDecisions, index + 1),
          locale,
          availableDefinitionActions,
          factCatalog ?? undefined,
          definition,
          workspace,
          serverParameterCatalog
        );
      })
    );
  }

  private loadCatalogPages(config: PolicyStudioRuntimeConfig): Observable<readonly DomainRuleCatalogCandidate[]> {
    const options = this.requestOptions(config);
    return this.domainRules.browseDefinitionCatalog(
      { page: 0, limit: ProjectionCatalogService.CATALOG_PAGE_LIMIT },
      options
    ).pipe(
      expand(page => page.hasMore && page.page < ProjectionCatalogService.MAX_CATALOG_PAGE
        ? this.fetchCatalogPageSafely(page.page + 1, options)
        : EMPTY),
      reduce((candidates, page) => [...candidates, ...page.candidates], [] as DomainRuleCatalogCandidate[]),
      map(candidates => this.latestCatalogCandidates(candidates.filter(candidate => candidate.ruleType !== AUTHORIZATION_RULE_TYPE)))
    );
  }

  private latestCatalogCandidates(
    candidates: readonly DomainRuleCatalogCandidate[]
  ): readonly DomainRuleCatalogCandidate[] {
    const latest = new Map<string, DomainRuleCatalogCandidate>();
    candidates.forEach(candidate => {
      const current = latest.get(candidate.ruleKey);
      if (!current || candidate.version > current.version) latest.set(candidate.ruleKey, candidate);
    });
    return [...latest.values()];
  }

  private catalogSummary(
    candidate: DomainRuleCatalogCandidate,
    index: number,
    total: number,
    locale: SupportedLocale,
    availableDefinitionActions: DecisionSummary['availableDefinitionActions'],
    factCatalog?: DomainRuleFactCatalog,
    definition?: DomainRuleDefinition,
    workspace?: DomainRuleChangeWorkspace,
    serverParameterCatalog?: DomainRuleParameterCatalog | null
  ): DecisionSummary {
    const context = candidate.contextKey?.trim() || candidate.resourceKey?.trim() || 'domain-decisions';
    const definitionBody = this.record(definition?.definition);
    const governanceBody = this.record(definition?.governance);
    const parametersBody = this.record(definition?.parameters);
    const conditionFactPaths = collectFactPaths(definition?.condition);
    const facts = this.decisionFacts(factCatalog, locale, definition?.condition);
    const parameterCatalog = this.overlayParameterCatalog(
      this.parameterCatalog(definition, serverParameterCatalog),
      workspace?.parameters
    );
    const slotPlanMeta = this.extractSlotPlanMetadata(definitionBody, undefined);
    const executorKind = this.stringValue(definitionBody, 'executorKind');
    const isForbiddenSlot =
      slotPlanMeta.slotOverridePolicy === 'FORBIDDEN'
      || slotPlanMeta.slotOverridePolicy === 'LOCKED'
      || executorKind === 'JAVA'
      || executorKind === 'JAVA_EXECUTOR';
    const hasConditionFacts =
      facts.length > 0
      && definition?.condition != null
      && conditionFactPaths.every(factPath => facts.some(fact => fact.path === factPath));
    const authoringSupported = !isForbiddenSlot && (hasConditionFacts
      || (parameterCatalog?.parameters.length ?? 0) > 0
      || this.hasEditableOperationalPolicy(definition));
    const definitionDocumentation = this.resolveDefinitionDocumentation(definitionBody, undefined);
    const hasWorkspaceDocField = !!workspace
      && Object.prototype.hasOwnProperty.call(workspace, DOMAIN_RULE_DOCUMENTATION_KEY)
      && (workspace as { documentation?: unknown }).documentation !== undefined;
    const workspaceDocumentation = workspace
      ? (hasWorkspaceDocField
          ? extractRuleDocumentation((workspace as { documentation?: unknown }).documentation)
          : definitionDocumentation)
      : null;
    const documentation = workspaceDocumentation ?? definitionDocumentation ?? null;
    const decisionKind = (definition?.ruleType ?? candidate.ruleType) === 'authorization_policy'
      ? 'AUTHORIZATION' as const
      : 'BUSINESS' as const;
    const code = this.stringValue(definitionBody, 'falseReasonCode')
      ?? this.stringValue(definitionBody, 'reasonCode')
      ?? this.stringValue(parametersBody, 'reasonCode')
      ?? this.operationalPolicyString(parametersBody, 'code')
      ?? this.inferReasonCodeFromRuleKey(candidate.ruleKey);
    const extCandidate = candidate as ExtendedCatalogCandidate;
    const presentationLabels = this.record(definitionBody?.['presentationLabels']);
    const domainLabel = this.localizedText(presentationLabels?.['domain'], locale)
      ?? this.localizedText(definitionBody?.['domainLabel'], locale)
      ?? extCandidate.domainLabel?.trim()
      ?? null;
    const ruleSetLabel = this.localizedText(presentationLabels?.['ruleSet'], locale)
      ?? this.localizedText(definitionBody?.['ruleSetLabel'], locale)
      ?? extCandidate.ruleSetLabel?.trim()
      ?? null;
    const name = this.localizedText(definitionBody?.['labels'], locale)
      ?? this.localizedText(definitionBody?.['title'], locale)
      ?? this.stringValue(definitionBody, 'presentationLabel')
      ?? this.stringValue(definitionBody, 'title')
      ?? documentation?.title
      ?? (extCandidate.displayName?.trim() || null)
      ?? candidate.ruleKey;
    const meaning = this.localizedText(definitionBody?.['descriptions'], locale)
      ?? this.localizedText(definitionBody?.['description'], locale)
      ?? this.stringValue(definitionBody, 'description')
      ?? this.stringValue(definitionBody, 'messagePtBr')
      ?? this.operationalPolicyString(parametersBody, 'message')
      ?? documentation?.summary
      ?? this.localizedText(definitionBody?.['labels'], locale)
      ?? this.localizedText(definitionBody?.['title'], locale)
      ?? this.stringValue(definitionBody, 'presentationLabel')
      ?? documentation?.title
      ?? candidate.ruleKey;
    const ruleSetKey = this.stringValue(definitionBody, 'ruleSetKey')
      ?? this.stringValue(parametersBody, 'ruleSetKey')
      ?? (candidate.resourceKey?.trim() || context);
    const resourceKey = this.stringValue(definitionBody, 'operationalResourceKey')
      ?? this.stringValue(parametersBody, 'operationalResourceKey')
      ?? candidate.resourceKey;
    const declaredBaseline = this.stringValue(governanceBody, 'baselineAuthority')
      ?? this.stringValue(governanceBody, 'sourceKind');
    const baselineAuthority = declaredBaseline
      ?? (locale === 'pt-BR' ? 'Não declarada no catálogo' : 'Not declared by the catalog');
    const currentAuthority = this.stringValue(governanceBody, 'currentAuthority')
      ?? (locale === 'pt-BR' ? 'Config · definição governada' : 'Config · governed definition');
    const authority = this.stringValue(governanceBody, 'currentAuthority') && declaredBaseline
      ? `${currentAuthority} · ${declaredBaseline}`
      : currentAuthority;
    const evidence = this.catalogEvidence(definitionBody, facts);
    const requiredFactPaths = this.stringArrayValue(definitionBody, 'requiredFactPaths');
    const usedFactPaths = this.stringArrayValue(definitionBody, 'usedFactPaths');
    const activeConditionFactPaths = collectFactPaths(workspace?.condition ?? definition?.condition)
      .filter(path => !isParameterFactPath(path));
    const evaluatedFactPaths = usedFactPaths?.length
      ? usedFactPaths
      : activeConditionFactPaths.length
        ? activeConditionFactPaths
        : (requiredFactPaths ?? []);
    return {
      order: index + 1,
      totalDecisions: total,
      key: candidate.ruleKey,
      code,
      name,
      domain: context,
      ...(domainLabel ? { domainLabel } : {}),
      ruleSet: candidate.resourceKey?.trim() || candidate.serviceKey?.trim() || context,
      ...(ruleSetLabel ? { ruleSetLabel } : {}),
      ruleSetKey,
      resourceKey,
      serviceKey: definition?.serviceKey?.trim() || candidate.serviceKey,
      state: ['approved', 'active'].includes(candidate.status) ? 'verified' : 'technical-draft',
      meaning,
      authority,
      baselineAuthority,
      source: this.stringValue(definitionBody, 'semanticSourceRef') ?? `definition:${candidate.definitionId}`,
      evidenceCount: evidence.length,
      authoringSupported,
      availableDefinitionActions,
      reviewStatus: authoringSupported ? 'CONFIG_GOVERNED' : 'CATALOG_IDENTITY_ONLY',
      configDefinitionId: candidate.definitionId,
      configVersion: candidate.version,
      configStatus: candidate.status,
      workspaceId: workspace?.id,
      workspaceStatus: workspace?.status,
      workspaceEtag: workspace?.etag,
      workspaceRevision: workspace?.revision,
      promotedDefinitionId: workspace?.promotedDefinitionId ?? null,
      workspaceCondition: workspace?.condition ?? null,
      workspaceParameters: workspace?.parameters ?? {},
      expression: formatDecisionExpression(definition?.condition),
      condition: definition?.condition ?? null,
      factPaths: facts.length
        ? facts.map(fact => fact.path)
        : requiredFactPaths?.length
          ? requiredFactPaths
          : conditionFactPaths,
      evaluatedFactPaths,
      facts,
      nullSemantics: this.stringValue(definition?.parameters, 'nullSemantics'),
      operationKeys: this.stringArrayValue(definition?.parameters, 'operationKeys') ?? [],
      hostContractVersion: this.stringValue(definition?.parameters, 'hostContractVersion'),
      evidence,
      draftLifecycle: this.stringValue(definition?.governance, 'lifecycleBoundary'),
      ruleType: definition?.ruleType ?? candidate.ruleType,
      decisionKind,
      parameters: definition?.parameters ?? {},
      parameterCatalog,
      detailHydrated: definition !== undefined,
      documentation,
      definitionDocumentation,
      workspaceDocumentation,
      ...slotPlanMeta
    };
  }

  private inferReasonCodeFromRuleKey(ruleKey: string): string {
    const match = /(?:^|[._:-])(c?erg|wf)[-_]?(\d{4,5})$/i.exec(ruleKey.trim());
    if (match) {
      return `${match[1].toUpperCase()}-${match[2]}`;
    }
    return ruleKey;
  }

  private projectionFacts(
    factPaths: readonly string[],
    factSchemas: DomainProjection['factSchemas']
  ): DecisionSummary['facts'] {
    return factPaths
      .map(factPath => factSchemas.find(item => item.path === factPath))
      .filter((schema): schema is DomainProjection['factSchemas'][number] => schema !== undefined)
      .map(schema => ({
        path: schema.path,
        valueType: schema.valueType,
        nullable: schema.nullable,
        label: schema.presentationLabel,
        description: schema.description,
        providerRef: schema.providerRef,
        evidenceRefs: schema.evidenceRefs,
        sensitivity: 'NON_SENSITIVE' as const,
        redaction: 'NONE' as const
      }));
  }

  private decisionFacts(
    factCatalog: DomainRuleFactCatalog | undefined,
    locale: SupportedLocale,
    condition?: unknown
  ): DecisionSummary['facts'] {
    const rawFacts = factCatalog?.facts ?? [];
    const allPaths = rawFacts.map(fact => fact.path);
    return rawFacts
      .filter(fact => fact.path.includes('.') || !allPaths.some(other => other.startsWith(`${fact.path}.`)))
      .map(fact => {
        const extra = fact as unknown as Record<string, unknown>;
        const restricted = fact.sensitivity === 'SECRET' || fact.redaction === 'OMIT';
        const hint = this.localizedText(extra['hints'], locale) ?? this.stringValue(extra, 'hint');
        const groupKey = this.stringValue(extra, 'groupKey');
        const groupLabel = this.localizedText(extra['groupLabels'], locale) ?? this.stringValue(extra, 'groupLabel');
        const unit = this.stringValue(extra, 'unit');
        const valuePresentation = this.stringValue(extra, 'valuePresentation');
        const mask = this.stringValue(extra, 'mask');
        const example = restricted ? null : this.stringValue(extra, 'example');
        const allowedValues = restricted ? null : this.parseFactAllowedValues(extra['allowedValues'], locale);
        const optionSourceRef = this.parseFactOptionSourceRef(extra['optionSourceRef']);
        const constraints = this.parseFactConstraints(extra['constraints']);
        const governance = this.parseFactGovernance(extra['governance']);
        const lineage = this.parseFactLineage(extra['lineage']);
        return {
          path: fact.path,
          valueType: fact.valueType === 'string' && this.conditionImpliesNumericFact(condition, fact.path)
            ? 'number'
            : fact.valueType,
          nullable: fact.nullable,
          label: this.localizedText(fact.labels, locale) ?? fact.path,
          description: this.localizedText(fact.descriptions, locale) ?? '',
          providerRef: fact.providerRef,
          evidenceRefs: fact.evidenceRefs,
          sensitivity: fact.sensitivity,
          redaction: fact.redaction,
          ...(hint ? { hint } : {}),
          ...(groupKey ? { groupKey } : {}),
          ...(groupLabel ? { groupLabel } : {}),
          ...(unit ? { unit } : {}),
          ...(valuePresentation ? { valuePresentation } : {}),
          ...(mask ? { mask } : {}),
          ...(allowedValues ? { allowedValues } : {}),
          ...(optionSourceRef ? { optionSourceRef } : {}),
          ...(example ? { example } : {}),
          ...(constraints ? { constraints } : {}),
          ...(governance ? { governance } : {}),
          ...(lineage ? { lineage } : {})
        };
      });
  }

  private parseFactAllowedValues(
    raw: unknown,
    locale: SupportedLocale
  ): readonly DecisionFactAllowedValue[] | null {
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const options: DecisionFactAllowedValue[] = [];
    for (const item of raw) {
      const rec = this.record(item);
      if (!rec) continue;
      const val = rec['value'];
      if (typeof val !== 'string' && typeof val !== 'number' && typeof val !== 'boolean') {
        continue;
      }
      const label = this.localizedText(rec['labels'], locale)
        ?? this.stringValue(rec, 'label')
        ?? String(val);
      const icon = this.stringValue(rec, 'icon');
      const tone = this.stringValue(rec, 'tone');
      const description = this.stringValue(rec, 'description');
      options.push({
        value: val,
        label,
        ...(icon ? { icon } : {}),
        ...(tone ? { tone } : {}),
        ...(description ? { description } : {})
      });
    }
    return options.length > 0 ? options : null;
  }

  private parseFactOptionSourceRef(raw: unknown): DecisionFactOptionSourceRef | null {
    const rec = this.record(raw);
    if (!rec) return null;
    const sourceKey = this.stringValue(rec, 'sourceKey');
    if (!sourceKey) return null;
    const resourceKey = this.stringValue(rec, 'resourceKey');
    return { sourceKey, ...(resourceKey ? { resourceKey } : {}) };
  }

  private parseFactConstraints(raw: unknown): DecisionFactConstraints | null {
    const rec = this.record(raw);
    if (!rec) return null;
    const num = (key: string): number | null =>
      typeof rec[key] === 'number' && Number.isFinite(rec[key] as number) ? (rec[key] as number) : null;
    const int = (key: string): number | null => {
      const value = num(key);
      return value !== null && Number.isInteger(value) ? value : null;
    };
    const min = num('min');
    const max = num('max');
    const step = num('step');
    const minLength = int('minLength');
    const maxLength = int('maxLength');
    const pattern = this.stringValue(rec, 'pattern');
    if (min === null && max === null && step === null && minLength === null && maxLength === null && pattern === null) {
      return null;
    }
    return {
      ...(min !== null ? { min } : {}),
      ...(max !== null ? { max } : {}),
      ...(step !== null ? { step } : {}),
      ...(minLength !== null ? { minLength } : {}),
      ...(maxLength !== null ? { maxLength } : {}),
      ...(pattern ? { pattern } : {})
    };
  }

  private parseFactGovernance(raw: unknown): DecisionFactGovernance | null {
    const rec = this.record(raw);
    if (!rec) return null;
    const classification = this.stringValue(rec, 'classification');
    const dataCategory = this.stringValue(rec, 'dataCategory');
    const exportable = typeof rec['exportable'] === 'boolean' ? (rec['exportable'] as boolean) : null;
    const aiVisibility = this.stringValue(rec, 'aiVisibility');
    const complianceTags = Array.isArray(rec['complianceTags'])
      ? rec['complianceTags'].filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
      : null;
    if (!classification && !dataCategory && exportable === null && !aiVisibility && (!complianceTags || complianceTags.length === 0)) {
      return null;
    }
    return {
      ...(classification ? { classification } : {}),
      ...(dataCategory ? { dataCategory } : {}),
      ...(exportable !== null ? { exportable } : {}),
      ...(aiVisibility ? { aiVisibility } : {}),
      ...(complianceTags && complianceTags.length > 0 ? { complianceTags } : {})
    };
  }

  private parseFactLineage(raw: unknown): DecisionFactLineage | null {
    const rec = this.record(raw);
    if (!rec) return null;
    const attributeId = this.stringValue(rec, 'attributeId');
    const sourceResourceKey = this.stringValue(rec, 'sourceResourceKey');
    const transformation = this.stringValue(rec, 'transformation');
    if (!attributeId && !sourceResourceKey && !transformation) return null;
    return {
      ...(attributeId ? { attributeId } : {}),
      ...(sourceResourceKey ? { sourceResourceKey } : {}),
      ...(transformation ? { transformation } : {})
    };
  }

  private conditionImpliesNumericFact(node: unknown, factPath: string): boolean {
    if (!node || typeof node !== 'object') return false;
    if (Array.isArray(node)) {
      return node.some(item => this.conditionImpliesNumericFact(item, factPath));
    }
    const entries = Object.entries(node as Record<string, unknown>);
    if (entries.length === 1) {
      const [op, rawArgs] = entries[0];
      const relational = op === '<' || op === '<=' || op === '>' || op === '>=';
      const equality = op === '==' || op === '===' || op === '!=' || op === '!==';
      if ((relational || equality) && Array.isArray(rawArgs) && rawArgs.length === 2) {
        const [lhs, rhs] = rawArgs;
        if (this.matchesVarPath(lhs, factPath) && typeof rhs === 'number' && Number.isFinite(rhs)) {
          return true;
        }
        if (this.matchesVarPath(rhs, factPath) && typeof lhs === 'number' && Number.isFinite(lhs)) {
          return true;
        }
      }
    }
    return entries.some(([, value]) => this.conditionImpliesNumericFact(value, factPath));
  }

  private matchesVarPath(expr: unknown, factPath: string): boolean {
    if (!expr || typeof expr !== 'object' || Array.isArray(expr)) return false;
    const record = expr as Record<string, unknown>;
    if (record['var'] === factPath) return true;
    return Array.isArray(record['coalesce']) && record['coalesce'].length > 0
      && this.matchesVarPath(record['coalesce'][0], factPath);
  }

  private catalogEvidence(
    definitionBody: Record<string, unknown> | null,
    facts: DecisionSummary['facts']
  ): DecisionSummary['evidence'] {
    const rawArtifacts = definitionBody?.['sourceArtifacts'];
    if (Array.isArray(rawArtifacts)) {
      const artifacts = rawArtifacts
        .map(item => this.record(item))
        .filter((item): item is Record<string, unknown> =>
          item !== null
          && typeof item['path'] === 'string' && item['path'].trim().length > 0
          && typeof item['kind'] === 'string' && item['kind'].trim().length > 0)
        .map(item => ({
          path: String(item['path']).trim(),
          kind: String(item['kind']).trim(),
          ...(typeof item['sha256'] === 'string' && item['sha256'].trim() ? { sha256: item['sha256'].trim() } : {})
        }));
      if (artifacts.length > 0) return artifacts;
    }
    const uniqueRefs = [...new Set(
      facts
        .flatMap(fact => fact.evidenceRefs)
        .filter((ref): ref is string => typeof ref === 'string' && ref.trim().length > 0)
        .map(ref => ref.trim())
    )];
    return uniqueRefs.map(path => ({ path, kind: 'FACT_PROVIDER_EVIDENCE' }));
  }

  private localizedText(value: unknown, locale: SupportedLocale): string | null {
    const record = this.record(value);
    if (!record) return null;
    const prefix = locale.split('-')[0]?.toLowerCase();
    const direct = this.stringValue(record, locale)
      ?? (prefix ? this.stringValue(record, prefix) : null)
      ?? this.stringValue(record, 'pt-BR')
      ?? this.stringValue(record, 'en-US');
    if (direct) return direct;
    for (const key of Object.keys(record)) {
      const candidate = this.stringValue(record, key);
      if (candidate) return candidate;
    }
    return null;
  }

  private operationalPolicyString(
    parameters: Record<string, unknown> | null,
    field: 'code' | 'message'
  ): string | null {
    if (!parameters) return null;
    for (const slot of ['validationPolicy', 'approvalPolicy', 'availabilityPolicy']) {
      const policy = this.record(parameters[slot]);
      const text = this.stringValue(policy, field);
      if (text) return text;
    }
    return null;
  }

  private fixtureSummaries(projection: DomainProjection, locale: SupportedLocale): readonly DecisionSummary[] {
    return projection.decisionRefs.map(decision => {
      const definitionDocumentation = this.resolveDefinitionDocumentation(null, decision);
      return {
        order: decision.order,
        totalDecisions: projection.decisionRefs.length,
        key: decision.decisionKey,
        code: decision.reasonCode ?? decision.decisionKey,
        name: decision.presentationLabel || definitionDocumentation?.title || decision.decisionKey,
        domain: projection.presentationLabels.domain[locale] ?? projection.ruleSetRef.boundedContextKey,
        ruleSet: projection.presentationLabels.ruleSet[locale] ?? projection.ruleSetRef.ruleSetKey,
        ruleSetKey: projection.ruleSetRef.ruleSetKey,
        resourceKey: projection.ruleSetRef.operationalResourceKey?.trim() || null,
        serviceKey: null,
        state: decision.semanticStatus === 'REFERENCE_IMPLEMENTED' ? 'verified' : 'technical-draft',
        meaning: decision.presentationLabel || definitionDocumentation?.summary || decision.decisionKey,
        authority: `${projection.authorityEvidence.currentAuthority} · ${projection.authorityEvidence.baselineAuthority}`,
        baselineAuthority: projection.authorityEvidence.baselineAuthority,
        source: decision.semanticSourceRef,
        evidenceCount: projection.sourceArtifacts.length,
        authoringSupported: false,
        availableDefinitionActions: [],
        reviewStatus: decision.reviewStatus,
        expression: null,
        condition: null,
        factPaths: decision.factPaths,
        evaluatedFactPaths: decision.factPaths,
        facts: this.projectionFacts(decision.factPaths, projection.factSchemas),
        nullSemantics: null,
        operationKeys: projection.ruleSetRef.operationKeys,
        hostContractVersion: projection.ruleSetRef.hostContractVersion ?? null,
        evidence: projection.sourceArtifacts,
        draftLifecycle: null,
        decisionKind: 'BUSINESS' as const,
        documentation: definitionDocumentation,
        definitionDocumentation,
        workspaceDocumentation: null,
        ...this.extractSlotPlanMetadata(null, decision)
      };
    });
  }

  private resolveDefinitionDocumentation(
    definitionBody: Record<string, unknown> | null,
    decisionRef?: DomainProjection['decisionRefs'][number]
  ): RuleDocumentationDescriptor | null {
    const nested = extractRuleDocumentation(definitionBody?.[DOMAIN_RULE_DOCUMENTATION_KEY]);
    if (nested) return nested;
    if (definitionBody && [
      'summary',
      'whenApplies',
      'rationale',
      'legalBasis',
      'customizationGuidance'
    ].some(field => definitionBody[field] !== undefined && definitionBody[field] !== null)) {
      const rootDoc = extractRuleDocumentation(definitionBody);
      if (rootDoc) return rootDoc;
    }
    const refRecord = this.record(decisionRef);
    if (!refRecord) return null;
    const refNested = extractRuleDocumentation(refRecord[DOMAIN_RULE_DOCUMENTATION_KEY]);
    if (refNested) return refNested;
    if ([
      'title',
      'summary',
      'whenApplies',
      'rationale',
      'legalBasis',
      'customizationGuidance'
    ].some(field => refRecord[field] !== undefined && refRecord[field] !== null)) {
      return extractRuleDocumentation(refRecord);
    }
    return null;
  }

  private extractSlotPlanMetadata(
    definitionBody: Record<string, unknown> | null,
    decisionRef?: DomainProjection['decisionRefs'][number]
  ): Pick<
    DecisionSummary,
    | 'slotKey'
    | 'decisionStage'
    | 'slotOverridePolicy'
    | 'slotCardinality'
    | 'availableRoots'
    | 'conceptRoots'
    | 'legacyOccurrence'
  > {
    const slotKey = this.stringValue(definitionBody, 'slotKey') ?? null;
    const rawStage = this.stringValue(definitionBody, 'decisionStage') ?? decisionRef?.stage ?? null;
    const validStages: readonly DecisionStageId[] = [
      'PROTECTED_GUARD',
      'DOMAIN_DECISION',
      'POST_DECISION',
      'TRANSFORMATION_INTENT',
      'EFFECT_INTENT'
    ];
    const decisionStage = rawStage && validStages.includes(rawStage as DecisionStageId)
      ? (rawStage as DecisionStageId)
      : null;

    const rawPolicy = this.stringValue(definitionBody, 'overridePolicy') ?? decisionRef?.overridePolicy ?? null;
    const normalizedPolicy = rawPolicy?.trim().toUpperCase() === 'EXTENSIBLE'
      ? 'EXTEND_ONLY'
      : rawPolicy?.trim().toUpperCase() ?? null;
    const validPolicies: readonly SlotOverridePolicyId[] = [
      'FORBIDDEN',
      'LOCKED',
      'PARAMETERIZABLE',
      'REPLACEABLE',
      'RESTRICT_ONLY',
      'EXTEND_ONLY'
    ];
    const slotOverridePolicy = normalizedPolicy && validPolicies.includes(normalizedPolicy as SlotOverridePolicyId)
      ? (normalizedPolicy as SlotOverridePolicyId)
      : null;

    const slotCardinality = this.stringValue(definitionBody, 'cardinality') ?? decisionRef?.cardinality ?? null;
    const availableRoots = this.stringArrayValue(definitionBody, 'availableRoots') ?? [];
    const conceptRoots = this.stringArrayValue(definitionBody, 'conceptRoots') ?? [];

    const legacyRec = this.record(definitionBody?.['legacyOccurrence']);
    const legacyCode = this.stringValue(legacyRec, 'code');
    const legacyOccurrence: DecisionLegacyOccurrence | null = legacyCode
      ? {
          code: legacyCode,
          targetField: this.stringValue(legacyRec, 'targetField'),
          plsqlOrigin: this.stringValue(legacyRec, 'plsqlOrigin'),
          plsqlLineage: this.stringValue(legacyRec, 'plsqlLineage')
        }
      : null;

    return {
      ...(slotKey ? { slotKey } : {}),
      ...(decisionStage ? { decisionStage } : {}),
      ...(slotOverridePolicy ? { slotOverridePolicy } : {}),
      ...(slotCardinality ? { slotCardinality } : {}),
      ...(availableRoots.length ? { availableRoots } : {}),
      ...(conceptRoots.length ? { conceptRoots } : {}),
      ...(legacyOccurrence ? { legacyOccurrence } : {})
    };
  }

  createDefinition(
    request: DomainRuleDefinitionRequest,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleDefinition> {
    return this.withRemoteCsrf(config, () =>
      this.domainRules.createDefinition(request, this.requestOptions(config)).pipe(
        tap(() => this.invalidateCatalogMetaCache())
      )
    );
  }

  readDefinition(id: string, config: PolicyStudioRuntimeConfig): Observable<DomainRuleDefinition> {
    return this.domainRules.getDefinition(id, this.requestOptions(config));
  }

  approveAccessDefinition(id: string, config: PolicyStudioRuntimeConfig): Observable<DomainRuleDefinition> {
    return this.withRemoteCsrf(config, () =>
      this.domainRules.transitionDefinitionStatus(
        id,
        { status: 'approved', validationResult: { review: 'approved', source: 'praxis-policy-studio' } },
        this.requestOptions(config)
      ).pipe(tap(() => this.invalidateCatalogMetaCache()))
    );
  }

  createWorkspace(
    baseDefinitionId: string,
    title: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleChangeWorkspace> {
    return this.withRemoteCsrf(config, () =>
      this.domainRules.createChangeWorkspace({ baseDefinitionId, title }, this.requestOptions(config)).pipe(
        tap(() => this.invalidateCatalogMetaCache())
      )
    );
  }

  saveWorkspaceDraft(
    workspace: Pick<DomainRuleChangeWorkspace, 'id' | 'etag' | 'parameters'>,
    condition: unknown,
    config: PolicyStudioRuntimeConfig,
    parameters?: Readonly<Record<string, unknown>>,
    documentation?: RuleDocumentationDescriptor | Record<string, unknown> | null
  ): Observable<DomainRuleChangeWorkspace> {
    const payload: Record<string, unknown> = {
      condition: this.record(condition),
      parameters: (parameters ?? workspace.parameters) as Record<string, unknown>,
      rationale: 'Rules Studio visual authoring round-trip'
    };
    if (documentation !== undefined) {
      payload['documentation'] = documentation;
    }
    return this.withRemoteCsrf(config, () =>
      this.domainRules.updateChangeWorkspaceDraft(
        workspace.id,
        payload as unknown as DomainRuleChangeWorkspaceUpdateRequest,
        workspace.etag,
        this.requestOptions(config)
      ).pipe(tap(() => this.invalidateCatalogMetaCache()))
    );
  }

  scenarios(workspaceId: string, config: PolicyStudioRuntimeConfig): Observable<DomainRuleTestScenario[]> {
    return this.domainRules.listTestScenarios(workspaceId, this.requestOptions(config));
  }

  workspaceCapabilities(
    workspaceId: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleWorkspaceCapabilities> {
    return this.domainRules.getChangeWorkspaceCapabilities(workspaceId, this.requestOptions(config));
  }

  createScenario(
    workspaceId: string,
    request: DomainRuleTestScenarioRequest,
    config: PolicyStudioRuntimeConfig
  ): Observable<{ readonly scenario: DomainRuleTestScenario; readonly workspace: DomainRuleChangeWorkspace }> {
    const options = this.requestOptions(config);
    return this.withRemoteCsrf(config, () =>
      this.domainRules.createTestScenario(workspaceId, request, options).pipe(
        switchMap(scenario => this.domainRules.getChangeWorkspace(workspaceId, options).pipe(
          map(workspace => ({ scenario, workspace }))
        ))
      )
    );
  }

  updateScenario(
    workspaceId: string,
    scenarioId: string,
    request: DomainRuleTestScenarioRequest,
    scenarioEtag: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<{ readonly scenario: DomainRuleTestScenario; readonly workspace: DomainRuleChangeWorkspace }> {
    const options = this.requestOptions(config);
    return this.withRemoteCsrf(config, () =>
      this.domainRules.updateTestScenario(workspaceId, scenarioId, request, scenarioEtag, options).pipe(
        switchMap(scenario => this.domainRules.getChangeWorkspace(workspaceId, options).pipe(
          map(workspace => ({ scenario, workspace }))
        ))
      )
    );
  }

  runSandbox(
    workspaceId: string,
    scenarioIds: readonly string[],
    idempotencyKey: string,
    evaluatedAtUtc: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<PolicySandboxRun> {
    const baseUrl = (config.configApiBaseUrl ?? '').replace(/\/$/, '');
    return this.withRemoteCsrf(config, () =>
      this.http.post<PolicySandboxRun>(`${baseUrl}/api/praxis/rules-studio/sandbox/runs`, {
        workspaceId,
        scenarioIds,
        userTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        idempotencyKey,
        evaluatedAtUtc
      })
    );
  }

  operationalTestAction(
    resourceKey: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<ResourceActionCatalogItem | null> {
    return this.discovery.getActionsByResourceKey(resourceKey, this.requestOptions(config)).pipe(
      map(catalog => {
        const candidates = catalog.actions.filter(action =>
          (action.tags.includes('rules-studio') || action.tags.includes('policy-studio')) && action.tags.includes('operational-proof'));
        if (candidates.length > 1) {
          throw new Error(`OPERATIONAL_ACTION_AMBIGUOUS ${resourceKey}`);
        }
        return candidates[0] ?? null;
      })
    );
  }

  runOperationalTest(
    action: ResourceActionCatalogItem,
    workspaceId: string,
    workspaceEtag: string,
    scenarios: readonly { readonly scenarioId: string; readonly operationMode: 'CREATE' | 'UPDATE' }[],
    idempotencyKey: string,
    evaluatedAtUtc: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<{ readonly run: DomainRuleTestRun; readonly workspaceEtag: string }> {
    const preconditions = action.execution?.preconditions;
    const targetIdField = preconditions?.resourceVersionTargetIdField?.trim();
    if (!action.availability.allowed
      || action.method.toUpperCase() !== 'POST'
      || preconditions?.resourceVersion !== 'REQUIRED'
      || preconditions.resourceVersionTransport !== 'IF_MATCH'
      || !preconditions.resourceVersionTargetResourceKey?.trim()
      || !targetIdField
      || preconditions.idempotencyKey !== 'REQUIRED') {
      return throwError(() => new Error('OPERATIONAL_ACTION_CONTRACT_UNAVAILABLE'));
    }
    const headers = new HttpHeaders()
      .set('If-Match', this.formatStrongIfMatch(workspaceEtag))
      .set('Idempotency-Key', idempotencyKey)
      .set('X-Correlation-ID', createClientRequestId());
    const body: Record<string, unknown> = {
      [targetIdField]: workspaceId,
      scenarios,
      userTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      evaluatedAtUtc
    };
    return this.withRemoteCsrf(config, () =>
      this.http.request<RestApiResponse<DomainRuleTestRun>>(
        action.method,
        this.discovery.resolveHref(action.path, this.requestOptions(config)),
        { body, headers, observe: 'response' }
      ).pipe(map(response => {
        if (!response.body?.data) throw new Error('OPERATIONAL_TEST_RUN_MISSING');
        const nextEtag = response.headers.get('ETag')?.trim();
        if (!nextEtag) throw new Error('OPERATIONAL_WORKSPACE_ETAG_MISSING');
        return { run: response.body.data, workspaceEtag: nextEtag };
      }))
    );
  }

  submitWorkspace(
    workspaceId: string,
    etag: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleChangeWorkspace> {
    return this.withRemoteCsrf(config, () =>
      this.domainRules.submitChangeWorkspace(workspaceId, etag, this.requestOptions(config)).pipe(
        tap(() => this.invalidateCatalogMetaCache())
      )
    );
  }

  reviews(workspaceId: string, config: PolicyStudioRuntimeConfig) {
    return this.domainRules.listChangeWorkspaceReviews(workspaceId, this.requestOptions(config));
  }

  reviewWorkspace(
    workspaceId: string,
    etag: string,
    decision: 'APPROVE' | 'REJECT',
    rationale: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleChangeWorkspace> {
    const options = this.requestOptions(config);
    return this.withRemoteCsrf(config, () =>
      this.domainRules.reviewChangeWorkspace(workspaceId, { decision, rationale }, etag, options).pipe(
        tap(() => this.invalidateCatalogMetaCache()),
        switchMap(() => this.domainRules.getChangeWorkspace(workspaceId, options))
      )
    );
  }

  promoteWorkspace(
    workspaceId: string,
    etag: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleChangeWorkspace> {
    return this.withRemoteCsrf(config, () =>
      this.domainRules.promoteChangeWorkspace(workspaceId, etag, this.requestOptions(config)).pipe(
        tap(() => this.invalidateCatalogMetaCache())
      )
    );
  }

  definitionActions(
    baseDefinitionId: string | null | undefined,
    ruleKey: string,
    baseVersion: number | null | undefined,
    promotedDefinitionId: string | null | undefined,
    config: PolicyStudioRuntimeConfig
  ): Observable<DecisionSummary['availableDefinitionActions']> {
    if (config.mode !== 'remote') return of([]);
    return this.domainRules.getDefinitionCapabilities(this.requestOptions(config)).pipe(
      map(capabilities => this.mergeDefinitionActions(
        capabilities,
        baseDefinitionId ?? null,
        ruleKey,
        baseVersion ?? null,
        promotedDefinitionId ?? null
      ))
    );
  }

  inspectPublicationReadiness(
    definitionId: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<PublicationReadiness> {
    return this.domainRules.simulate({ ruleDefinitionId: definitionId }, this.requestOptions(config)).pipe(
      map(simulation => ({
        result: simulation.result ?? null,
        readiness: this.stringValue(simulation.explainability, 'publicationReadiness'),
        existingCoverage: simulation.existingCoverage ?? [],
        predictedMaterializations: simulation.predictedMaterializations ?? [],
        requiredApprovals: simulation.requiredApprovals ?? [],
        warnings: simulation.warnings ?? [],
        recommendedAction: this.stringValue(simulation.explainability, 'recommendedAction')
      }))
    );
  }

  publishDefinition(
    definitionId: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DecisionPublicationResult> {
    return this.withRemoteCsrf(config, () =>
      this.domainRules.publish({
        ruleDefinitionId: definitionId,
        applyEligibleMaterializations: true,
        publicationNotes: { source: 'praxis-policy-studio', intent: 'publish-governed-definition' }
      }, this.requestOptions(config)).pipe(
        tap(() => this.invalidateCatalogMetaCache()),
        map(publication => ({
          status: publication.publicationStatus ?? null,
          readiness: publication.publicationReadiness ?? null,
          materializationCount: publication.materializations?.length ?? 0,
          outcomes: publication.explainability?.publicationDiagnostics?.materializationOutcomes ?? []
        }))
      )
    );
  }

  lifecycle(
    workspaceId: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DecisionLifecycleSummary> {
    return this.domainRules.inspectChangeWorkspaceLifecycle(
      workspaceId,
      null,
      this.requestOptions(config)
    ).pipe(map(inspection => ({
      workspaceStatus: inspection.workspace.status,
      workspaceRevision: inspection.workspace.revision,
      testRunCount: inspection.testRuns.length,
      reviewCount: inspection.reviews.length,
      materializationCount: inspection.materializations.length,
      promotedDefinitionId: inspection.workspace.promotedDefinitionId ?? null,
      submittedTestRunId: inspection.workspace.submittedTestRunId,
      latestTestRun: inspection.testRuns[0] ?? null
    })));
  }

  snapshotCockpit(
    ruleSetKey: string, operationKey: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<{
    readonly head: DomainRuleSnapshotHeadStatus | null;
    readonly versions: readonly DomainRuleSnapshotVersion[];
  }> {
    if (config.mode !== 'remote') return of({ head: null, versions: [] });
    const options = this.requestOptions(config);
    const head = this.domainRules.getSnapshotHeadStatus(ruleSetKey, operationKey, options).pipe(
      catchError((error: unknown) => this.isMissingSnapshotHead(error)
        ? of(null)
        : throwError(() => error))
    );
    return forkJoin({
      head,
      versions: this.domainRules.listSnapshotVersions(ruleSetKey, operationKey, 50, options)
    });
  }

  activeSnapshot(
    ruleSetKey: string, operationKey: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleSnapshotActivation | null> {
    if (config.mode !== 'remote') return of(null);
    return this.domainRules.getSnapshotHead(ruleSetKey, operationKey, this.requestOptions(config)).pipe(
      catchError((error: unknown) => this.isMissingSnapshotHead(error)
        ? of(null)
        : throwError(() => error))
    );
  }

  executionSummary(snapshotKey: string, config: PolicyStudioRuntimeConfig): Observable<DomainRuleExecutionSummary> {
    return this.domainRules.getSnapshotExecutionSummary(snapshotKey, this.requestOptions(config));
  }

  hostStatusSummary(ruleSetKey: string, operationKey: string, config: PolicyStudioRuntimeConfig): Observable<DomainRuleHostStatusSummary> {
    return this.domainRules.getSnapshotHostStatusSummary(ruleSetKey, operationKey, this.requestOptions(config));
  }

  rolloutPolicyCatalog(
    ruleSetKey: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleRolloutPolicyCatalog> {
    return this.domainRules.getRolloutPolicyCatalog(ruleSetKey, this.requestOptions(config));
  }

  rolloutPolicyTimeline(
    ruleSetKey: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<readonly DomainRuleRolloutPolicyEvent[]> {
    return this.domainRules.getRolloutPolicyTimeline(ruleSetKey, this.requestOptions(config));
  }

  createRolloutPolicy(
    request: DomainRuleRolloutPolicyCreateRequest,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleRolloutPolicyMutation> {
    return this.withRemoteCsrf(config, () =>
      this.domainRules.createRolloutPolicy(request, this.requestOptions(config))
    );
  }

  approveRolloutPolicy(
    policy: Pick<DomainRuleRolloutPolicy, 'policyId'>,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleRolloutPolicyMutation> {
    return this.withRemoteCsrf(config, () =>
      this.domainRules.approveRolloutPolicy(policy.policyId, this.requestOptions(config))
    );
  }

  activateRolloutPolicy(
    policy: Pick<DomainRuleRolloutPolicy, 'policyId'>,
    policyHeadEtag: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleRolloutPolicyMutation> {
    return this.withRemoteCsrf(config, () =>
      this.domainRules.activateRolloutPolicy(policy.policyId, policyHeadEtag, this.requestOptions(config))
    );
  }

  rolloutCatalog(ruleSetKey: string, operationKey: string, config: PolicyStudioRuntimeConfig): Observable<DomainRuleRolloutCatalog> {
    return this.domainRules.getRolloutCatalog(ruleSetKey, operationKey, this.requestOptions(config));
  }

  createRollout(
    candidateSnapshotKey: string,
    headEtag: string | null,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleRollout> {
    return this.withRemoteCsrf(config, () =>
      this.domainRules.createRollout({ candidateSnapshotKey }, headEtag, this.requestOptions(config))
    );
  }

  probeRolloutCandidate(
    ruleSetKey: string,
    rolloutId: string,
    operationKey: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<{ readonly updated: boolean; readonly observedAtUtc: string }> {
    const baseUrl = (config.configApiBaseUrl ?? '').replace(/\/$/, '');
    return this.withRemoteCsrf(config, () =>
      this.http.post<{ readonly updated: boolean; readonly observedAtUtc: string }>(
        `${baseUrl}/api/praxis/rules-studio/rule-sets/${encodeURIComponent(ruleSetKey)}/rollouts/${encodeURIComponent(rolloutId)}/probe?operationKey=${encodeURIComponent(operationKey)}`,
        {}
      )
    );
  }

  cancelRollout(
    rollout: Pick<DomainRuleRolloutCatalogItem, 'rollout'>,
    config: PolicyStudioRuntimeConfig
  ): Observable<void> {
    return this.withRemoteCsrf(config, () =>
      this.domainRules.cancelRollout(rollout.rollout.rolloutId, this.requestOptions(config))
    );
  }

  activateRolloutCandidate(
    rollout: Pick<DomainRuleRolloutCatalogItem, 'rollout'>,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleSnapshotActivation> {
    return this.withRemoteCsrf(config, () =>
      this.domainRules.activateSnapshotCandidate(
        rollout.rollout.candidateSnapshotKey,
        rollout.rollout.expectedHeadEtag,
        rollout.rollout.rolloutId,
        this.requestOptions(config)
      )
    );
  }

  operateSnapshot(
    version: Pick<DomainRuleSnapshotVersion, 'snapshotKey' | 'availableAction'>,
    headEtag: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleSnapshotActivation> {
    const options = this.requestOptions(config);
    if (version.availableAction === 'ACTIVATE') {
      return this.withRemoteCsrf(config, () =>
        this.domainRules.activateSnapshot(version.snapshotKey, headEtag, options)
      );
    }
    if (version.availableAction === 'ROLLBACK') {
      return this.withRemoteCsrf(config, () =>
        this.domainRules.rollbackSnapshot(version.snapshotKey, headEtag, options)
      );
    }
    return throwError(() => new Error(`SNAPSHOT_ACTION_NOT_AVAILABLE ${version.availableAction}`));
  }

  snapshotHeadSet(
    ruleSetKey: string,
    operationKeys: readonly string[],
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleSnapshotHeadSetResponse | null> {
    if (config.mode !== 'remote' || !ruleSetKey || operationKeys.length === 0) return of(null);
    return this.domainRules.getSnapshotHeadSet(ruleSetKey, operationKeys, this.requestOptions(config)).pipe(
      catchError((error: unknown) => this.isMissingSnapshotHead(error)
        ? of(null)
        : throwError(() => error))
    );
  }

  withdrawSnapshotHead(
    request: DomainRuleSnapshotWithdrawalRequest,
    headEtag: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleSnapshotWithdrawalResponse> {
    this.candidateHeadPrecondition(headEtag);
    return this.withRemoteCsrf(config, () =>
      this.domainRules.withdrawSnapshotHead(request, headEtag, this.requestOptions(config))
    );
  }

  prepareRuleSetCandidate(
    ruleSetKey: string,
    request: RuleSetCompositionCandidateRequest,
    config: PolicyStudioRuntimeConfig
  ): Observable<RuleSetCompositionCandidate> {
    return this.withRemoteCsrf(config, () =>
      this.domainRules.prepareRuleSetCandidate(ruleSetKey, request, this.requestOptions(config))
    );
  }

  approveRuleSetCandidate(
    ruleSetKey: string,
    command: RuleSetCompositionCandidateCommand,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleCompositionApproval> {
    return this.withRemoteCsrf(config, () =>
      this.domainRules.approveRuleSetCandidate(ruleSetKey, command, this.requestOptions(config))
    );
  }

  publishRuleSetCandidate(
    ruleSetKey: string,
    command: RuleSetCompositionCandidateCommand,
    currentHeadEtag: string | null,
    config: PolicyStudioRuntimeConfig
  ): Observable<RuleSetCompositionPublication> {
    this.candidateHeadPrecondition(currentHeadEtag);
    return this.withRemoteCsrf(config, () =>
      this.domainRules.publishRuleSetCandidate(ruleSetKey, command, currentHeadEtag, this.requestOptions(config))
    );
  }

  prepareSnapshotComposition(
    request: DomainRuleSnapshotCompositionRequest,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleCompositionManifest> {
    return this.withRemoteCsrf(config, () =>
      this.domainRules.prepareSnapshotComposition(request, this.requestOptions(config))
    );
  }

  approveSnapshotComposition(
    request: DomainRuleSnapshotCompositionRequest,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleCompositionApproval> {
    return this.withRemoteCsrf(config, () =>
      this.domainRules.approveSnapshotComposition(request, this.requestOptions(config))
    );
  }

  publishSnapshot(
    request: DomainRuleSnapshotPublicationRequest,
    currentHeadEtag: string | null,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleSnapshotStored> {
    return this.withRemoteCsrf(config, () =>
      this.domainRules.publishSnapshot(request, currentHeadEtag, this.requestOptions(config))
    );
  }

  timeline(definitionId: string, config: PolicyStudioRuntimeConfig): Observable<readonly DecisionTimelineEvent[]> {
    if (config.mode !== 'remote') return of([]);
    return this.domainRules.getDefinitionTimeline(definitionId, this.requestOptions(config)).pipe(
      map(response => response.events.map(event => {
        const ext = event as unknown as {
          readonly status?: string | null;
          readonly summaryCode?: string | null;
          readonly summaryArgs?: Readonly<Record<string, unknown>> | null;
        };
        return {
          eventType: event.eventType,
          occurredAt: event.occurredAt ?? '',
          summary: event.summary ?? event.eventType,
          ...(ext.summaryCode ? { summaryCode: ext.summaryCode } : {}),
          ...(ext.summaryArgs ? { summaryArgs: ext.summaryArgs } : {}),
          status: ext.status ?? null,
          actor: event.actor ?? null
        };
      }))
    );
  }

  overlayParameterCatalog(
    catalog: DecisionParameterCatalog | null | undefined,
    parametersRecord: Readonly<Record<string, unknown>> | null | undefined
  ): DecisionParameterCatalog | null {
    if (!catalog) return null;
    const declaredValues = this.record(parametersRecord?.['parameterValues']);
    if (!declaredValues) return catalog;
    return {
      ...catalog,
      parameters: catalog.parameters.map(descriptor => {
        const hasDeclared = Object.prototype.hasOwnProperty.call(declaredValues, descriptor.name);
        if (!hasDeclared) return descriptor;
        const declaredValue = declaredValues[descriptor.name];
        return {
          ...descriptor,
          declaredValue,
          effectiveValue: declaredValue,
          origin: 'DECLARED'
        };
      })
    };
  }

  private candidateHeadPrecondition(headEtag: string | null): HttpHeaders {
    const headers = new HttpHeaders();
    const trimmed = headEtag?.trim() ?? '';
    if (!trimmed) {
      return headers.set('If-None-Match', '*');
    }
    return headers.set('If-Match', this.formatStrongIfMatch(trimmed));
  }

  private formatStrongIfMatch(etag: string | null | undefined): string {
    const trimmed = etag?.trim() ?? '';
    if (!trimmed || /^W\//i.test(trimmed)) {
      throw new Error('Strong entity tag is required');
    }
    return /^"[^"\r\n]*"$/.test(trimmed) ? trimmed : `"${trimmed}"`;
  }

  private hasParameterTemplate(definition: DomainRuleDefinition | undefined): boolean {
    const template = this.record(this.record(definition?.definition)?.['parameterTemplate']);
    return !!template && Array.isArray(template['parameters']);
  }

  private hasEditableOperationalPolicy(definition: DomainRuleDefinition | undefined): boolean {
    const parameters = this.record(definition?.parameters);
    if (!parameters) return false;
    return ['validationPolicy', 'availabilityPolicy', 'approvalPolicy']
      .some(slot => this.record(parameters[slot]) !== null);
  }

  private fetchDefinitionParameters(
    definitionId: string,
    config: PolicyStudioRuntimeConfig
  ): Observable<DomainRuleParameterCatalog> {
    return this.domainRules.getDefinitionParameters(definitionId.trim(), this.requestOptions(config));
  }

  private parameterCatalog(
    definition: DomainRuleDefinition | undefined,
    serverCatalog?: DomainRuleParameterCatalog | null
  ): DecisionParameterCatalog | null {
    const template = this.record(this.record(definition?.definition)?.['parameterTemplate']);
    const rawParameters = Array.isArray(template?.['parameters'])
      ? (template!['parameters'] as unknown[])
      : [];
    const uiMetadata = new Map<string, { label: string | null; description: string | null; expressionPointers: readonly string[] }>();
    rawParameters
      .map(item => this.record(item))
      .filter((item): item is Record<string, unknown> => item !== null && typeof item['name'] === 'string')
      .forEach(item => {
        uiMetadata.set(String(item['name']).trim(), {
          label: this.stringValue(item, 'label'),
          description: this.stringValue(item, 'description'),
          expressionPointers: this.stringArrayValue(item, 'expressionPointers') ?? []
        });
      });

    if (!serverCatalog || serverCatalog.parameters.length === 0) return null;
    return {
      definitionId: serverCatalog.definitionId,
      ruleKey: serverCatalog.ruleKey,
      version: serverCatalog.definitionVersion ?? definition?.version ?? 1,
      schemaVersion: serverCatalog.schemaVersion,
      templateKey: serverCatalog.templateKey,
      templateVersion: serverCatalog.templateVersion,
      parameters: serverCatalog.parameters.map((param: DomainRuleParameterDescriptor) => {
        const meta = uiMetadata.get(param.name);
        return {
          name: param.name,
          label: meta?.label ?? null,
          description: meta?.description ?? null,
          type: param.type,
          required: param.required,
          nullable: param.nullable,
          readOnly: param.readOnly,
          defaultValue: param.defaultValue,
          declaredValue: param.declaredValue,
          effectiveValue: param.effectiveValue,
          minimum: param.minimum ?? null,
          maximum: param.maximum ?? null,
          allowedValues: param.allowedValues ?? undefined,
          unit: param.unit ?? null,
          origin: param.origin,
          ...(meta?.expressionPointers.length ? { expressionPointers: meta.expressionPointers } : {})
        };
      })
    };
  }

  private latestWorkspace(
    workspaces: readonly DomainRuleChangeWorkspace[],
    ruleKey: string
  ): DomainRuleChangeWorkspace | undefined {
    const statusPriority = (status: string | null | undefined): number => {
      switch ((status ?? '').trim().toUpperCase()) {
        case 'OPEN':
          return 4;
        case 'SUBMITTED':
          return 3;
        case 'APPROVED':
          return 2;
        case 'PROMOTED':
          return 1;
        default:
          return 0;
      }
    };
    const timestamp = (iso: string | null | undefined): number => {
      if (!iso) return 0;
      const parsed = Date.parse(iso);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return workspaces
      .filter(item => item.ruleKey === ruleKey)
      .sort((left, right) => {
        const statusDiff = statusPriority(right.status) - statusPriority(left.status);
        if (statusDiff !== 0) return statusDiff;
        const timeDiff = timestamp(right.updatedAt) - timestamp(left.updatedAt);
        if (timeDiff !== 0) return timeDiff;
        const isoDiff = (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '');
        if (isoDiff !== 0) return isoDiff;
        return (right.revision ?? 0) - (left.revision ?? 0);
      })[0];
  }

  private mergeDefinitionActions(
    definitionCapabilities: DomainRuleDefinitionCapabilities,
    baseDefinitionId: string | null,
    ruleKey: string,
    baseVersion: number | null,
    promotedDefinitionId: string | null
  ): DecisionSummary['availableDefinitionActions'] {
    const baseCapability = definitionCapabilities.definitions.find(capability =>
      capability.definitionId === baseDefinitionId
      && capability.ruleKey === ruleKey
      && (baseVersion === null || capability.version === baseVersion));
    const promotedCapability = promotedDefinitionId
      ? definitionCapabilities.definitions.find(capability =>
          capability.definitionId === promotedDefinitionId
          && capability.ruleKey === ruleKey)
      : undefined;
    return [...new Set([
      ...(baseCapability?.availableActions ?? []),
      ...(promotedCapability?.availableActions ?? [])
    ])];
  }

  private withRemoteCsrf<T>(
    config: PolicyStudioRuntimeConfig,
    action: () => Observable<T>
  ): Observable<T> {
    return this.authSession.ensureCsrf(config).pipe(switchMap(action));
  }

  private requestOptions(config: PolicyStudioRuntimeConfig): DomainRuleRequestOptions {
    return { apiUrlEntry: { baseUrl: config.configApiBaseUrl ?? '' } };
  }

  private isMissingSnapshotHead(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 404;
  }

  private stringValue(record: Record<string, unknown> | null | undefined, key: string): string | null {
    const value = record?.[key];
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private stringArrayValue(
    record: Record<string, unknown> | null | undefined,
    key: string
  ): readonly string[] | null {
    const value = record?.[key];
    return Array.isArray(value) && value.every(item => typeof item === 'string') ? value : null;
  }

  private record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  }
}
