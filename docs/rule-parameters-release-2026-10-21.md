# Governed parameters — coordinated adoption

This record follows the historical source-only proof in
[rule-parameters-candidate.md](rule-parameters-candidate.md). It does not replace or
rewrite the rc.34 source/tarball hashes in `rule-parameters-source-evidence.json`.

## Release identity and order

- Angular source candidate: `667e6d7d5`, rebased onto `1c797be9d` (rc.35), with
  parameter catalog model/client/spec and canonical Core documentation.
- Angular source PR [#621](https://github.com/codexrodrigues/praxis-ui-angular/pull/621)
  was independently reviewed and merged as `7365e83acf3e7f5323d70fe8ab892f6144c630c8`.
- Prospective cohort: all 22 `@praxisui/*` packages at `10.0.0-rc.36`, npm channel
  `rc`. `latest` remains on the stable 9.x line.
- The unrelated rc.35 train finished successfully, including public npm
  postflight, in GitHub run `39604746143`.
- The prospective version was applied locally only through
  `node projects/tools/bump-version.js 10.0.0-rc.36`. All 22 source manifests were
  then restored byte for byte to the rc.35 checkpoint before PR preparation.
- Final rc.36 source versions must be persisted by the official main-branch
  `build-libs.yml` dispatch with explicit version and `create_tag=true`. Its
  atomic main/tag push triggers the sole publication build in
  `publish-from-tag.yml`; that run seals the tarballs, publishes them through npm
  OIDC and verifies public install/channel/integrity for the complete cohort.

The Config checkout used by the local preflight is disposable and exclusive:
`640d0c4f3d2975f3692d5c3d738da83e01fb21eb`, matching the existing workflow pin.
Comparing it with `63e1e2d7` showed only registry snapshot bytes and their test
constants in the relevant registry paths; the generator overwrites those files.
Parameter catalogs do not change AI registry contracts, so the workflow pin was
preserved. The sync helper writes only `registry-snapshot.json` and expected
constants in `AiRegistrySnapshotContractTest`; it does not delete documentation.

## Gates already executed

- Rebased Core service specs: 34 passed; direct focal Core production build passed.
- Official prospective rc.36 local preflight: all 22 builds, package audit, local
  public-link validation, AI registry/contracts (20/20), peer validation, published
  doc assets, npm docs, free-version registry gate, packing and all 22 tarball
  validations passed.
- After adding the Core client documentation, its dependency closure and
  documentation/packing/tarball gates were refreshed. The final candidate Core
  tarball contains that documentation.
- Generated `component-docs.json` exposed an unrelated pre-existing rich-content
  activity-timeline example drift. That source file was restored; it is not part
  of this PR. Registry/package generation remains part of the official release.
- Studio is validated against a prospective rc.36 public-package dependency
  closure: its seven direct packages plus `@praxisui/dialog`. These local tarballs
  do not constitute a published-registry lock or a published Studio release.

## Existing snapshot semantics materialized by Studio

Core rc.35 already separates immutable snapshot publication
(`DomainRuleSnapshotStored`) from active-head mutation. The host contract
`RuleSetCompositionPublication` beta.5 already returns only snapshot key, RuleSet
key/version and content hash. Studio consumes neither that host receipt nor a
snapshot publication command, and does not synthesize an active head from them.

Studio `main` integrated that bootstrap materialization in PR #59, commit
`f427d70517062814b3d9e7657a36c7b961d71203`, alongside published rc.35 adoption.
Our checkpoint `feb3f6c` was rebased onto that commit as `d73b3d2`; duplicate
bootstrap handlers and tests were removed. Manifest and lock were retained byte
for byte from the new main until published rc.36 is verified. The current delta
adds parameter editing and blocks rollout controls/commands while the rollout
catalog itself is loading or failed, preserving main's confirmed-token checks.

The cockpit shows policies and staged rollout without an active head. A
successful head read returning 404, a per-version `CREATE_ROLLOUT` action and the
rollout catalog action jointly permit the bootstrap command. Loading, denied or
failed head reads, unavailable versions and stale confirmation actions remain
blocked. The command passes explicit null to Core, which sends only
`If-None-Match: *`; existing heads retain their real `If-Match` token. Activation
continues through the separately authorized operator/rollout action. Publishing
or staging alone does not make a snapshot active, and the browser does not
recompute quorum, policy authority or readiness.

## Integration and publication gates still to close

1. Angular source review/merge is complete. Official rc.36 preparation was
   dispatched in run `39609740850`; publication and public postflight remain
   coordinated by the root task. No local npm publication.
2. Update the seven Studio dependencies to the exact published rc.36 and generate
   the lock from the public registry. Run clean `npm ci`, lint, unit tests, static
   build and focused desktop/narrow browser proof from that registry install.
3. Independent review and merge of the Studio consumer. Do not tag a Studio release
   merely to mark a source commit; retain its documented release process.
4. Canonical skill integration and selective local sync are coordinated separately
   by the root task; historical local guidance is not proof of that integration.

The Studio Render control plane was read directly: service
`srv-da0fbqlbedkc73ald6e0` (`praxis-policy-studio-homolog`) tracks Studio `main` with
`autoDeploy=yes` and `autoDeployTrigger=commit`. Its build is
`npm ci && npm run build:static`. Therefore merging Studio triggers its homolog
static deployment. The published Quickstart must expose the new authenticated
parameter endpoint first, since Studio intentionally fails closed when the catalog
is unavailable. No Maestro service, repository, runtime or deployment is part of
this release.

## Evidence limits

Unit/client tests and intercepted browser fixtures prove consumer behavior, headers,
state and accessibility. They do not prove real parameter persistence or host
activation. The coordinated Config/Quickstart remote Neon proof owns those claims.
Actual published npm artifact identities, final lock integrity, workflow/PR links
and homolog deployment identity must be appended when those gates complete.
