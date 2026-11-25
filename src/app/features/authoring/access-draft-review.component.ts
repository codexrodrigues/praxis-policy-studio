import { JsonPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type DomainRuleDefinition, type DomainRuleDefinitionRequest } from '@praxisui/core';
import { EMPTY, of, switchMap } from 'rxjs';
import { AuthSessionService } from '../../core/auth-session.service';
import { type CopyKey, PolicyStudioI18n } from '../../core/i18n';
import {
  type ExtendedCatalogCandidate,
  ProjectionCatalogService
} from '../../core/projection-catalog.service';
import { type PolicyStudioRuntimeConfig } from '../../core/runtime-config';
import { AUTHORIZATION_RULE_TYPE, accessPreview, readPreparedAccessDraft } from '../../core/prepared-access-draft';
import type { StudioViewDepth } from '../../core/studio-shell-state.service';
import { CatalogSelectionStore } from '../catalog/catalog-selection.store';
import { AccessReleaseComponent } from './access-release.component';
import { PapCatalogComponent } from './pap-catalog.component';

@Component({
  selector: 'pax-access-draft-review',
  imports: [JsonPipe, PapCatalogComponent, AccessReleaseComponent],
  templateUrl: './access-draft-review.component.html',
  styleUrl: './access-draft-review.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccessDraftReviewComponent {
  readonly config = input.required<PolicyStudioRuntimeConfig>();
  readonly viewDepth = input<StudioViewDepth>('business');
  readonly preferredResourceKey = input<string | null>(null);
  readonly preferredServiceKey = input<string | null>(null);
  readonly i18n = inject(PolicyStudioI18n);
  protected readonly present = Boolean;
  private readonly auth = inject(AuthSessionService);
  private readonly catalog = inject(ProjectionCatalogService);
  private readonly store = inject(CatalogSelectionStore, { optional: true });
  private readonly destroy = inject(DestroyRef);

  readonly source = signal('');
  readonly candidate = signal<ReturnType<typeof readPreparedAccessDraft> | null>(null);
  readonly stored = signal<DomainRuleDefinition | null>(null);
  readonly definitionId = signal('');
  readonly existingPolicies = signal<readonly ExtendedCatalogCandidate[] | null>(null);
  readonly existingLoading = signal(false);
  readonly existingQuery = signal('');
  readonly existingStatusFilter = signal('');
  readonly existingHasMore = signal(false);
  readonly existingTotalElements = signal<number | null>(null);
  readonly busy = signal(false);
  readonly error = signal<CopyKey | null>(null);
  readonly attempted = signal(false);
  private existingPage = 0;
  private existingLoadRevision = 0;
  private receipt: DomainRuleDefinition | null = null;

  editSource(value: string): void {
    this.source.set(value);
    this.candidate.set(null);
    this.stored.set(null);
    this.definitionId.set('');
    this.receipt = null;
    this.attempted.set(false);
    this.error.set(null);
  }

  applyGeneratedDraft(value: string): void {
    this.editSource(value);
    this.review();
  }

  loadExistingPolicies(append = false): void {
    const config = this.config();
    if (config.mode !== 'remote' || this.existingLoading() || this.busy()) return;
    const loadRevision = ++this.existingLoadRevision;
    const targetPage = append ? this.existingPage + 1 : 0;
    this.existingLoading.set(true);
    this.error.set(null);
    const sessionCheck$ = this.store?.sessionActive()
      ? of(true)
      : this.auth.hasSession(config);
    sessionCheck$.pipe(
      switchMap(active => {
        if (loadRevision !== this.existingLoadRevision) return EMPTY;
        if (!active) {
          this.existingLoading.set(false);
          this.error.set('authenticationRequired');
          return EMPTY;
        }
        if (typeof this.catalog.browseAccessCatalog === 'function') {
          return this.catalog.browseAccessCatalog(config, {
            page: targetPage,
            limit: this.store?.catalogSummary() ? 25 : 12,
            query: this.existingQuery(),
            status: this.existingStatusFilter()
          });
        }
        return this.catalog.listAccessDefinitions(config).pipe(
          switchMap(items => of({
            candidates: items.map(item => ({
              definitionId: item.id,
              ruleKey: item.ruleKey,
              version: item.version ?? 1,
              ruleType: item.ruleType ?? 'authorization_policy',
              status: item.status ?? 'draft',
              contextKey: item.contextKey ?? null,
              resourceKey: item.resourceKey ?? null,
              serviceKey: item.serviceKey ?? null,
              semanticOwner: item.semanticOwner ?? null,
              updatedAt: item.updatedAt ?? ''
            })),
            page: 0,
            limit: Math.max(items.length, 1),
            hasMore: false,
            totalElements: items.length,
            truncated: false
          }))
        );
      }),
      takeUntilDestroyed(this.destroy)
    ).subscribe({
      next: pageResult => {
        if (loadRevision !== this.existingLoadRevision) return;
        this.existingLoading.set(false);
        this.existingPage = pageResult.page;
        this.existingHasMore.set(pageResult.hasMore);
        this.existingTotalElements.set(pageResult.totalElements);
        const existing = append ? (this.existingPolicies() ?? []) : [];
        const seen = new Set(existing.map(item => item.definitionId));
        const merged = [
          ...existing,
          ...pageResult.candidates.filter(item => !seen.has(item.definitionId))
        ];
        this.existingPolicies.set(merged);
      },
      error: failure => {
        if (loadRevision !== this.existingLoadRevision) return;
        this.existingLoading.set(false);
        this.error.set(this.errorFor(failure, 'accessLoadExistingFailed'));
      }
    });
  }

  selectExistingPolicy(item: ExtendedCatalogCandidate): void {
    this.definitionId.set(item.definitionId);
    this.stored.set(null);
    this.error.set(null);
    this.read();
  }

  existingCountSummary(): string | null {
    const loaded = this.existingPolicies()?.length ?? 0;
    const total = this.existingTotalElements();
    if (!loaded || total === null || total <= loaded) return null;
    return this.i18n.format('accessShowingCount', { loaded, total });
  }

  review(): void {
    this.error.set(null);
    try {
      this.candidate.set(readPreparedAccessDraft(this.source()));
    } catch {
      this.candidate.set(null);
      this.error.set('accessInvalid');
    }
  }

  save(): void {
    const candidate = this.candidate();
    const config = this.config();
    if (!candidate || config.mode !== 'remote' || this.busy() || this.attempted()) return;
    this.busy.set(true);
    this.error.set(null);
    this.auth.hasSession(config).pipe(
      switchMap(active => {
        if (!active) {
          this.busy.set(false);
          this.error.set('authenticationRequired');
          return EMPTY;
        }
        this.attempted.set(true);
        return this.catalog.createDefinition(candidate.request, config);
      }),
      takeUntilDestroyed(this.destroy)
    ).subscribe({
      next: receipt => {
        this.busy.set(false);
        if (!this.isId(receipt?.id) || receipt.ruleKey !== candidate.request.ruleKey.trim()
          || receipt.version !== candidate.request.version || receipt.ruleType !== AUTHORIZATION_RULE_TYPE || receipt.status !== 'draft') {
          this.error.set('accessUncertain');
          return;
        }
        this.receipt = receipt;
        this.definitionId.set(receipt.id);
        this.read();
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        if (!this.attempted()) {
          this.error.set(this.errorFor(failure, 'accessSessionFailed'));
        } else if (failure instanceof HttpErrorResponse && failure.status >= 400 && failure.status < 500) {
          this.error.set(this.errorFor(failure, 'accessRejected'));
        } else {
          this.error.set('accessUncertain');
        }
      }
    });
  }

  read(): void {
    const id = this.definitionId().trim();
    const receipt = this.receipt?.id === id ? this.receipt : null;
    const expected = receipt ? this.candidate()?.request : null;
    if (this.config().mode !== 'remote' || this.busy()) return;
    this.error.set(null);
    this.stored.set(null);
    if (!this.isId(id)) {
      this.error.set('accessIdRequired');
      return;
    }
    this.busy.set(true);
    this.catalog.readDefinition(id, this.config()).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: definition => {
        this.busy.set(false);
        try {
          const allowedStatuses = receipt
            ? ['draft', 'proposed', 'approved']
            : ['draft', 'proposed', 'approved', 'active'];
          if (definition.id !== id
            || definition.ruleType !== AUTHORIZATION_RULE_TYPE
            || !allowedStatuses.includes(definition.status ?? '')) {
            throw new Error('ACCESS_DRAFT_REQUIRED');
          }
          if (receipt && expected && (!matchesSubmittedDraft(expected, definition)
            || receipt.tenantId !== definition.tenantId || receipt.environment !== definition.environment
            || receipt.createdBy !== definition.createdBy)) {
            this.error.set('accessReadChanged');
            return;
          }
          accessPreview(definition.definition);
          this.stored.set(definition);
        } catch {
          this.error.set('accessReadMismatch');
        }
      },
      error: failure => {
        this.busy.set(false);
        this.error.set(this.errorFor(failure, 'accessReadFailed'));
      }
    });
  }

  approve(): void {
    const current = this.stored();
    const config = this.config();
    if (!current || config.mode !== 'remote' || this.busy()) return;
    if (current.status !== 'draft' && current.status !== 'proposed') return;
    this.busy.set(true);
    this.error.set(null);
    this.auth.hasSession(config).pipe(
      switchMap(active => {
        if (!active) {
          this.busy.set(false);
          this.error.set('authenticationRequired');
          return EMPTY;
        }
        return this.catalog.approveAccessDefinition(current.id, config);
      }),
      takeUntilDestroyed(this.destroy)
    ).subscribe({
      next: approved => {
        this.busy.set(false);
        this.stored.set(approved);
      },
      error: failure => {
        this.busy.set(false);
        this.error.set(this.errorFor(failure, 'accessApproveFailed'));
      }
    });
  }

  private isId(id: unknown): id is string {
    return typeof id === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);
  }

  private errorFor(error: unknown, fallback: CopyKey): CopyKey {
    if (error instanceof HttpErrorResponse && error.status === 401) return 'authenticationRequired';
    if (error instanceof HttpErrorResponse && error.status === 403) return 'permissionLimited';
    return fallback;
  }
}

function matchesSubmittedDraft(input: DomainRuleDefinitionRequest, stored: DomainRuleDefinition): boolean {
  const textFields = ['ruleKey', 'resourceKey', 'serviceKey', 'contextKey', 'semanticOwner', 'steward'] as const;
  const referenceIds = ['sourceReleaseId', 'sourceChangeSetId'] as const;
  return input.version === stored.version
    && textFields.every(key => (input[key]?.trim() || null) === (stored[key] ?? null))
    && referenceIds.every(key => (input[key]?.toLowerCase() ?? null) === (stored[key] ?? null))
    && jsonValue(input.definition) === jsonValue(stored.definition)
    && jsonValue(input.governance ?? {}) === jsonValue(stored.governance)
    && jsonValue(input.parameters ?? {}) === jsonValue(stored.parameters)
    && stored.condition == null;
}

// JSONB may return object keys in a different order. Preserve array ordering.
function jsonValue(value: unknown): string | undefined {
  return JSON.stringify(value, (_, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0))
      : item);
}
