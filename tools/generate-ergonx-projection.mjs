import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProjection } from './projection-contract.mjs';

const studioRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationRoot = path.resolve(process.argv[2] ?? process.env.ERGON_MIGRATION_ROOT ?? 'D:/CodexHome/worktrees/rn013-dynamic-full-block');
const outputPath = path.join(studioRoot, 'public/projections/ergonx-rn013.v1.json');
const migrationRevision = execFileSync('git', ['-C', migrationRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

const sources = [
  ['tools/migration-factory/rn013-full-block-config-payload.psm1', 'CONFIG_MATERIALIZER'],
  ['ms-administracao-pessoal/src/main/java/com/example/praxis/msadministracaopessoal/administracaopessoal/rule/RegraFrequenciaMainPreHostContract.java', 'HOST_CONTRACT'],
  ['docs/migracao/ERGadm00036/rule-migration/rn013-full-block-dynamic-executor-selection.md', 'EXECUTOR_SELECTION'],
  ['docs/migracao/ERGadm00036/rule-migration/rn013-full-block-functional-live-proof-2026-08-11.json', 'FUNCTIONAL_EVIDENCE'],
  ['docs/migracao/ERGadm00036/rule-migration/rule-traceability-matrix.md', 'TRACEABILITY']
];
const commandDtoPath = 'ms-administracao-pessoal/src/main/java/com/example/praxis/msadministracaopessoal/administracaopessoal/dto/RegraFrequenciaCommandDTO.java';
const evidenceRoots = [
  'docs/migracao/rule-migration/factory-contracts/review/rn-013',
  'docs/migracao/rule-migration/factory-contracts/review/rn-013a'
];

async function sourceArtifact([relativePath, kind]) {
  const bytes = await readFile(path.join(migrationRoot, relativePath));
  return { path: relativePath.replaceAll('\\', '/'), kind, sha256: createHash('sha256').update(bytes).digest('hex').toUpperCase() };
}

const moduleText = await readFile(path.join(migrationRoot, sources[0][0]), 'utf8');
const hostText = await readFile(path.join(migrationRoot, sources[1][0]), 'utf8');
const commandDtoText = await readFile(path.join(migrationRoot, commandDtoPath), 'utf8');
const decisionPattern = /\[ordered\]@\{ order = (\d+); key = '([^']+)'; evaluator = '([^']+)'; field = '([^']+)'; threshold = ([^;]+); reasonCode = '([^']+)'; summary = '([^']+)'/g;
const decisions = [...moduleText.matchAll(decisionPattern)].map(match => ({
  order: Number(match[1]),
  decisionKey: match[2],
  reasonCode: match[6],
  presentationLabel: match[7],
  semanticStatus: 'TECHNICAL_DRAFT_READY',
  reviewStatus: 'BUSINESS_REVIEW_PENDING',
  semanticSourceRef: `${sources[0][0]}#DecisionCatalog[${Number(match[1]) - 1}]`,
  targetPlanRef: 'docs/migracao/rule-migration/factory-contracts/review/rn-013',
  editable: match[2] === 'regra-frequencia.quantidade-maxima.coerente-com-minima',
  factPaths: decisionFactPaths(match[3], match[4])
}));
const hostKeys = [...hostText.matchAll(/step\(\s*\d+\s*,\s*"([^"]+)"/g)].map(match => match[1]);
if (decisions.length !== 14 || hostKeys.length !== 14) throw new Error(`RN013_CARDINALITY_DRIFT materializer=${decisions.length} host=${hostKeys.length}`);
if (decisions.map(item => item.decisionKey).join('|') !== hostKeys.join('|')) throw new Error('RN013_HOST_ORDER_DRIFT');

const factEvidence = await loadFactEvidence();
const requiredFactPaths = [...new Set(decisions.flatMap(item => item.factPaths))].sort();
const factSchemas = requiredFactPaths.map(factPath => {
  const memberName = factPath.split('.').at(-1);
  const matches = factEvidence.filter(item => item.providerRef === `RegraFrequenciaCommandDTO.${memberName}`);
  if (matches.length === 0) throw new Error(`RN013_FACT_EVIDENCE_MISSING ${factPath}`);
  const binding = matches[0].sourceBinding;
  if (matches.some(item => item.status !== 'VERIFIED' || item.sourceBinding?.nullable !== binding.nullable || item.valueType !== matches[0].valueType)) {
    throw new Error(`RN013_FACT_EVIDENCE_CONFLICT ${factPath}`);
  }
  const documentation = dtoMemberDocumentation(memberName);
  return {
    path: factPath,
    valueType: normalizeValueType(matches[0].valueType),
    nullable: binding.nullable,
    presentationLabel: documentation.label,
    description: documentation.description,
    locale: 'pt-BR',
    providerRef: matches[0].providerRef,
    evidenceRefs: matches.map(item => item.__relativePath).sort()
  };
});

const projection = {
  kind: 'ERGONX_POLICY_STUDIO_PROJECTION_V1',
  projectionId: 'ergonx.workforce.frequency-and-absence.rn-013',
  projectionVersion: 1,
  generatedFromRevision: migrationRevision,
  sourceArtifacts: await Promise.all([
    ...sources,
    [commandDtoPath, 'FACT_SCHEMA_SOURCE'],
    ...factEvidence.map(item => [item.__relativePath, 'FACT_PROVIDER_EVIDENCE'])
  ].map(sourceArtifact)),
  ruleSetRef: {
    domainKey: 'workforce', boundedContextKey: 'workforce.frequency-and-absence',
    ruleSetKey: 'workforce.frequency-and-absence.frequency-rules', hostContractVersion: 'rn013-host-v2',
    operationKeys: ['create', 'update']
  },
  decisionRefs: decisions,
  factSchemas,
  configDefinitionRefs: {
    status: 'NOT_RESOLVED_IN_VERSIONED_EVIDENCE', definitionIds: [],
    blocker: 'Fourteen Config definition identifiers must be obtained from a governed Config projection; the Studio must not infer them.'
  },
  resourceLinks: [
    { relation: 'authoring-impact', resourceKey: 'administracao-pessoal.regras-frequencia' },
    { relation: 'consumer-screen', logicalScreenKey: 'ERGadm00036', resolution: 'HOST_OWNED' }
  ],
  presentationLabels: {
    domain: { 'pt-BR': 'Frequência e afastamentos', 'en-US': 'Frequency and absence' },
    ruleSet: { 'pt-BR': 'Validações de frequência', 'en-US': 'Frequency validations' }
  },
  evidenceBoundaries: [
    { boundary: 'DB_BACKED_PARITY', operations: ['create', 'update'], status: 'PROVED_DEVELOPMENT' },
    { boundary: 'DYNAMIC_POLICY_CHANGE', operations: ['create'], status: 'PROVED_DEVELOPMENT' },
    { boundary: 'VISUAL_LIFECYCLE', operations: ['create'], status: 'PROVED_SEPARATE_SURFACE' },
    { boundary: 'BUSINESS_HOMOLOGATION', operations: [], status: 'DEFERRED' }
  ],
  authorityEvidence: {
    currentAuthority: 'KEEP_DB_BACKED', baselineAuthority: 'LEGACY_AUTHORITATIVE',
    developmentEvidence: 'JAVA_AUTHORITATIVE_DEVELOPMENT_HISTORICAL_AND_REVERSIBLE', productionAuthorityChanged: false
  }
};

const errors = validateProjection(projection);
if (errors.length) throw new Error(`PROJECTION_INVALID ${errors.join(',')}`);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(projection, null, 2)}\n`, 'utf8');
console.log(`ERGONX_PROJECTION_GENERATED decisions=${decisions.length} output=${outputPath}`);

function decisionFactPaths(evaluator, field) {
  const root = 'regraFrequenciaCommand';
  if (evaluator === 'QUANTITY_RANGE') return [`${root}.quantidadeMaximaDias`, `${root}.quantidadeMinimaDias`];
  if (evaluator === 'PERIOD_ORDER') return [`${root}.dataInicio`, `${root}.dataFim`];
  return [`${root}.${field}`];
}

async function loadFactEvidence() {
  const result = [];
  for (const relativeRoot of evidenceRoots) {
    const directory = path.join(migrationRoot, relativeRoot);
    for (const entry of await readdir(directory)) {
      if (!entry.endsWith('.fact-provider-evidence.json')) continue;
      const relativePath = `${relativeRoot}/${entry}`;
      const document = JSON.parse(await readFile(path.join(migrationRoot, relativePath), 'utf8'));
      if (document.provider === 'regraFrequenciaCommand') result.push({ ...document, __relativePath: relativePath });
    }
  }
  return result.sort((left, right) => left.__relativePath.localeCompare(right.__relativePath));
}

function dtoMemberDocumentation(memberName) {
  const memberPattern = new RegExp(`((?:\\s*@[^\\n]+(?:\\([^;]*?\\))?\\s*)+)private\\s+(?:Integer|LocalDate)\\s+${memberName}\\s*;`, 's');
  const block = commandDtoText.match(memberPattern)?.[1];
  const label = block?.match(/@UISchema\([\s\S]*?label\s*=\s*"([^"]+)"/)?.[1];
  const description = block?.match(/@Schema\([\s\S]*?description\s*=\s*"([^"]+)"/)?.[1];
  if (!label || !description) throw new Error(`RN013_FACT_DOCUMENTATION_MISSING ${memberName}`);
  return { label, description };
}

function normalizeValueType(valueType) {
  const base = valueType.split('|')[0];
  if (base === 'number') return 'number';
  if (base === 'date') return 'date';
  throw new Error(`RN013_FACT_TYPE_UNSUPPORTED ${valueType}`);
}
