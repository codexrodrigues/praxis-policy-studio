import { JsonPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, output, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { GovernedHostScopeService } from '../../core/governed-host-scope.service';
import { type CopyKey, PolicyStudioI18n } from '../../core/i18n';
import { PapAuthoringCatalogService, type PapFact, type PapService } from '../../core/pap-authoring-catalog.service';
import type { PolicyStudioRuntimeConfig } from '../../core/runtime-config';

@Component({
  selector: 'pax-pap-catalog',
  imports: [JsonPipe],
  templateUrl: './pap-catalog.component.html',
  styleUrl: './pap-catalog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PapCatalogComponent {
  readonly config = input.required<PolicyStudioRuntimeConfig>();
  readonly preferredResourceKey = input<string | null>(null);
  readonly preferredServiceKey = input<string | null>(null);
  readonly draftGenerated = output<string>();
  readonly i18n = inject(PolicyStudioI18n);
  private readonly catalog = inject(PapAuthoringCatalogService);
  private readonly scope = inject(GovernedHostScopeService);
  private request?: Subscription;

  readonly services = signal<readonly PapService[] | null>(null);
  readonly busy = signal(false);
  readonly error = signal<CopyKey | null>(null);
  readonly serviceKey = linkedSignal(() => {
    const catalogs = this.services();
    if (!catalogs?.length) return '';
    const preferredResource = this.preferredResourceKey()?.trim();
    if (preferredResource) {
      const matched = catalogs.find(item =>
        item.decisionPoints.some(point => point.resourceKey === preferredResource)
      );
      if (matched) return matched.serviceKey;
    }
    const preferredService = this.preferredServiceKey()?.trim();
    if (preferredService) {
      const byService = catalogs.find(item => item.serviceKey === preferredService);
      if (byService) return byService.serviceKey;
    }
    return catalogs[0]?.serviceKey ?? '';
  });
  readonly service = computed(() => this.services()?.find(item => item.serviceKey === this.serviceKey()));
  readonly pointKey = linkedSignal(() => {
    const points = this.service()?.decisionPoints ?? [];
    const preferredResource = this.preferredResourceKey()?.trim();
    if (preferredResource) {
      const matched = points.find(item => item.resourceKey === preferredResource);
      if (matched) return matched.pointKey;
    }
    return points[0]?.pointKey ?? '';
  });
  readonly hasPreferredResourceMatch = computed(() => {
    const preferredResource = this.preferredResourceKey()?.trim();
    const catalogs = this.services();
    if (!preferredResource || !catalogs) return false;
    return catalogs.some(item =>
      item.decisionPoints.some(point => point.resourceKey === preferredResource)
    );
  });
  readonly point = computed(() => this.service()?.decisionPoints.find(item => item.pointKey === this.pointKey()));
  readonly modes = computed(() => Object.keys(this.point()?.factsByMode ?? {}));
  readonly mode = linkedSignal(() => {
    const available = this.modes();
    return available.includes('TARGET') ? 'TARGET' : (available[0] ?? '');
  });
  readonly selectedFacts = computed<readonly PapFact[]>(() => this.point()?.factsByMode[this.mode()] ?? []);
  readonly draftEffect = signal<'ALLOW' | 'DENY'>('ALLOW');
  readonly draftAuthority = signal<'GRANT' | 'RESTRICT'>('GRANT');
  readonly draftFactPath = linkedSignal(() => {
    const facts = this.selectedFacts();
    return facts.find(item => item.factPath === 'subject.principalId')?.factPath ?? facts[0]?.factPath ?? '';
  });
  readonly draftOperator = linkedSignal<'!=' | '==' | 'in'>(() =>
    this.draftFactPath() === 'subject.principalId' ? '!=' : '=='
  );
  readonly draftExpectedValue = linkedSignal(() => {
    const path = this.draftFactPath();
    if (path === 'subject.principalId') return '';
    const fact = this.selectedFacts().find(item => item.factPath === path);
    if (fact?.valueType === 'BOOLEAN') return 'true';
    if (fact?.valueType === 'INT64' || fact?.valueType === 'DECIMAL') return '1';
    return 'ACTIVE';
  });
  readonly draftReasonCode = linkedSignal(() =>
    this.draftEffect() === 'ALLOW' ? 'CUSTOM_ACCESS_ALLOW' : 'CUSTOM_ACCESS_DENY'
  );
  readonly reference = computed(() => ({
    kind: 'EXACT', pointKey: this.pointKey(), expectedDescriptorDigest: this.point()?.descriptorDigest,
    evaluationModes: [this.mode()]
  }));

  constructor() {
    effect(onCleanup => {
      this.config();
      this.scope.scope();
      this.services.set(null);
      this.error.set(null);
      this.busy.set(false);
      onCleanup(() => this.request?.unsubscribe());
    });
  }

  load(): void {
    if (this.config().mode !== 'remote' || this.busy()) return;
    this.busy.set(true);
    this.services.set(null);
    this.error.set(null);
    this.request = this.catalog.load(this.config()).subscribe({
      next: result => {
        this.busy.set(false);
        if (Array.isArray(result?.services)) this.services.set(result.services);
        else this.error.set('papUnavailable');
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        const status = failure instanceof HttpErrorResponse ? failure.status : 0;
        this.error.set(status === 401 ? 'authenticationRequired' : status === 403 ? 'permissionLimited' : 'papUnavailable');
      }
    });
  }

  setDraftAuthority(value: string): void {
    const authority = value === 'RESTRICT' ? 'RESTRICT' : 'GRANT';
    this.draftAuthority.set(authority);
    this.draftEffect.set(authority === 'GRANT' ? 'ALLOW' : 'DENY');
  }

  setDraftEffect(value: string): void {
    const effect = value === 'DENY' ? 'DENY' : 'ALLOW';
    this.draftEffect.set(effect);
    this.draftAuthority.set(effect === 'ALLOW' ? 'GRANT' : 'RESTRICT');
  }

  generateDraft(): void {
    const selectedService = this.service();
    const selectedPoint = this.point();
    const availableModes = this.modes();
    const selectedMode = availableModes.includes('TARGET') ? 'TARGET' : (this.mode() || 'TARGET');
    if (!selectedService || !selectedPoint) return;

    const slug = selectedPoint.resourceKey.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'resource';
    const pointSlug = selectedPoint.pointKey.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || slug;
    const modeSlug = selectedMode.toLowerCase();
    const selectedFact = this.selectedFacts().find(item => item.factPath === this.draftFactPath());
    const expression = this.buildConditionExpression(selectedFact);
    const reasonCode = this.draftReasonCode().trim() || (this.draftEffect() === 'ALLOW' ? 'CUSTOM_ACCESS_ALLOW' : 'CUSTOM_ACCESS_DENY');
    const policyId = `pol-${pointSlug}-${modeSlug}`;

    const draftRequest = {
      ruleKey: `${selectedPoint.resourceKey}.${modeSlug}.access-policy`,
      version: 1,
      ruleType: 'authorization_policy',
      status: 'draft',
      contextKey: selectedPoint.resourceKey,
      resourceKey: selectedPoint.resourceKey,
      serviceKey: selectedService.serviceKey,
      governance: {
        lifecycleBoundary: 'domain_rule_change_workspace',
        ruleAuthoring: 'review_required',
        requiredApprovals: ['human-review']
      },
      definition: {
        schemaVersion: 'praxis.authorization-policy/v1',
        policyId,
        version: '1.0.0',
        title: `${selectedPoint.resourceKey} · ${selectedMode} ACCESS`,
        description: `Draft generated from PAP point ${selectedPoint.pointKey} (${selectedMode}).`,
        policyPurposes: ['ACCESS_GOVERNANCE'],
        legalPurpose: 'HUMAN_RESOURCES_ADMINISTRATION',
        legalBasisRef: 'LGPD:ART_7_III',
        combiningProfileRef: 'praxis.authorization-combining/v1',
        targets: [
          {
            targetId: 'tgt-1',
            kind: 'EXACT',
            pointKey: selectedPoint.pointKey,
            expectedDescriptorDigest: selectedPoint.descriptorDigest,
            evaluationModes: [selectedMode]
          }
        ],
        factRequirements: [],
        rules: [
          {
            ruleId: `rule-${pointSlug}-${modeSlug}`,
            description: `Evaluates ${this.draftAuthority()} / ${this.draftEffect()} on ${selectedPoint.pointKey}`,
            evaluationModes: [selectedMode],
            when: {
              language: 'praxis-json-logic',
              profile: 'AUTHORIZATION_TARGET_V1',
              expression
            },
            contributions: {
              access: {
                authority: this.draftAuthority(),
                effect: this.draftEffect()
              },
              fieldUse: [],
              fieldWrite: [],
              mask: [],
              reasonCode
            },
            obligations: []
          }
        ],
        materializationTargets: [
          {
            targetLayer: 'policy_engine',
            targetArtifactType: 'opa-policy',
            targetArtifactKey: `unit:${policyId}:v1`,
            compilerProfileRef: 'praxis.rego-compiler-profile/v1'
          }
        ]
      }
    };

    this.draftGenerated.emit(JSON.stringify(draftRequest, null, 2));
  }

  private buildConditionExpression(fact: PapFact | undefined): Record<string, unknown> {
    const path = this.draftFactPath().trim();
    if (!path) {
      return { '==': [1, 1] };
    }
    const op = this.draftOperator();
    const rawExpected = this.draftExpectedValue();
    if (op === 'in') {
      const values = rawExpected.split(',').map(item => this.coerceScalarValue(item.trim(), fact)).filter(v => v !== '');
      return fact?.cardinality === 'SET'
        ? { in: [values[0] ?? 'ROLE_USER', { var: path }] }
        : { in: [{ var: path }, values.length ? values : ['ACTIVE']] };
    }
    return {
      [op]: [{ var: path }, this.coerceScalarValue(rawExpected, fact)]
    };
  }

  private coerceScalarValue(raw: string, fact: PapFact | undefined): unknown {
    const trimmed = raw.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if ((fact?.valueType === 'INT64' || fact?.valueType === 'DECIMAL') && trimmed !== '') {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) return parsed;
    }
    return raw;
  }
}
