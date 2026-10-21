# Governed rule parameters — source candidate

Classification: `contrato-publico` across Config, Engine, Core and Policy Studio.

Config owns the persisted parameter template and workspace lifecycle; Engine owns
parameter types, constraints, resolution and compilation. Core publishes the typed
catalog client. Studio materializes that catalog and edits only
`workspace.parameters.parameterValues` while preserving other parameter metadata.

## Adherence and impact

- `lacuna-real-de-contrato`: Core lacked the typed client for Config's
  `GET /api/praxis/config/domain-rules/definitions/{id}/parameters` catalog.
- `ja-suportado-mal-nomeado-ou-mal-materializado`: definitions, conditions, facts,
  workspace values, capabilities and ETags were already loaded. Generic catalog
  summaries discarded workspace information, and dirty tracking considered only
  the condition. These projections now preserve that existing information.
- `suportado-parcialmente`: existing visual authoring persisted opaque parameters
  but did not expose template values, constraints, explicit null or omission.

The new client follows `getDefinitionFacts` discovery/header resolution. Catalog
identity, definition version and schema version must match the selected definition.
Errors and permission failures block editing; there is no old-deployment fallback.
A matching template enables the parameter surface even without a domain projection;
Config capabilities continue to govern every operation. Non-template generic rules
remain read only.

Values are typed scalars. An omitted property uses the governed default; an own
property with null declares null. Required parameters can use a declared default,
including an explicit nullable default. Optional `defaultValue` and `declaredValue`
properties preserve the distinction between absence and JSON null. Default/effective
hints refer to the base definition catalog; workspace controls show the current
workspace values. Studio checks type, inclusive bounds, enumeration and nullability
for input feedback; the server remains authoritative. Read-only values cannot be
edited. The condition editor is unavailable for template rules. Parameter saves
send `condition: null` and consume Config's newly derived condition and ETag.
Template rules never use generic publication/materialization, even if a stale
capability offers PUBLISH; the Operate surface directs users to the existing
snapshot cockpit and the reviewed snapshot candidate.

Dirty tracking, unsaved-work confirmation, reset, save, close/reopen and reload
include parameters. A numerical formatting-only change does not invalidate governed
evidence. The expression formatter displays multiplication in ratio conditions
without evaluating facts in the browser.

## Historical rc.34 source dependency gate

This section records the initial source-only proof; current adoption is recorded
in [the release log](rule-parameters-release-2026-10-21.md).

Studio's former seven direct `@praxisui/*` dependencies were `9.0.5-rc.38`. At that proof,
Angular main was `10.0.0-rc.34`. The candidate manifest/lock aligned that cohort, including
canonical action fixture fields `interaction.riskLevel` and `availability.reason`.

The new Core method is a **source candidate**, not a claim about the already
published `10.0.0-rc.34` package. Tests use tarballs packed from the isolated Angular
source tree and installed into the isolated Studio tree. This work does not publish
packages. Adoption requires a published coherent cohort containing the new Core API
and an updated exact version/lock in Studio; a clean registry install of that historical
lock alone does not prove this candidate.

Source validation recipe (run from the assigned Angular/Studio worktrees):

```sh
# Angular: focal Core validation. build:praxis-core resolves the transitive source
# dependency closure (13 libraries here); direct ng build keeps this gate focal.
./node_modules/.bin/ng build praxis-core --configuration production
npm run test:core -- --include=projects/praxis-core/src/lib/services/domain-rule.service.spec.ts

# Pack the same source cohort: core, ai, cron-builder, dynamic-fields,
# metadata-editor, settings-panel, visual-builder.
npm pack ./dist/praxis-core --pack-destination <candidate-directory>
# Repeat pack for each of the other six already-built packages.

# Studio: consume packed public packages, preserving the registry manifest/lock.
npm ci --ignore-scripts --no-audit --no-fund
npm install --no-save --ignore-scripts --no-audit --no-fund <candidate-directory>/*.tgz
npm run lint
npm test
npm run build
npm run e2e -- e2e/policy-studio-corporate.spec.ts --grep 'round-trips typed rule parameters|preserves the governed workspace'
```

Do not use source symlinks or `tsconfig.paths` to substitute for package consumption.
The npm 10.9.7 invocation with `--package-lock=false` encountered an Arborist
`edgesOut` null error while recomputing unrelated peers. Standard `--no-save` uses
the existing lock successfully and leaves the checked-in lock on registry artifacts.

## Evidence boundary and derived artifacts

HTTP client mocks prove URL/header/body mapping. Component tests prove typed draft
semantics, ETag forwarding, immutable metadata, stale-selection isolation, errors,
read-only behavior and reopen state. The corporate browser lane uses mocked Config
responses and proves desktop/narrow input, validation, save/reopen/reload and AXE,
in PT/EN, including a catalog without a projection. It is not real persistence or
Neon/host sandbox proof; the coordinated Config/Quickstart validation owns that gate.

No AI component manifest or registry is added: this is an existing domain service
and a consumer projection, not a new public component authoring surface. Landing,
HTTP corpus and canonical skills are coordinated with the backend increment.
The Core domain-governance and Angular validation skills require updates for the
new parameter client/source-package gate and the non-focal build wrapper behavior.


## Coordinated adoption after the historical source proof

The rc.34 tarball/source hashes in `rule-parameters-source-evidence.json` remain
historical evidence and are not reused as proof of a later release. The new
release record is [the coordinated adoption log](rule-parameters-release-2026-10-21.md).
It records the rebase onto rc.35, the prospective rc.36 cohort, the clean published
consumer lock gate and the bootstrap cockpit materialization supported by the
existing Core/Config contracts.
