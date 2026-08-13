import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProjection } from './projection-contract.mjs';

const studioRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const quickstartRoot = path.resolve(
  process.argv[2] ?? process.env.PRAXIS_QUICKSTART_ROOT ?? path.join(studioRoot, '..', 'praxis-api-quickstart')
);
const sourcePath = path.join(
  quickstartRoot,
  'src/test/resources/policy-studio/extraordinary-benefit-policy-studio-projection.v1.json'
);
const outputPath = path.join(studioRoot, 'public/projections/quickstart-benefit-eligibility.v1.json');

const projection = JSON.parse(await readFile(sourcePath, 'utf8'));
const errors = validateProjection(projection);
if (errors.length) throw new Error(`QUICKSTART_PROJECTION_INVALID ${errors.join(',')}`);

for (const artifact of projection.sourceArtifacts) {
  const bytes = await readFile(path.join(quickstartRoot, artifact.path));
  const digest = createHash('sha256').update(bytes).digest('hex').toUpperCase();
  if (digest !== artifact.sha256) {
    throw new Error(`QUICKSTART_SOURCE_DIGEST_DRIFT ${artifact.path}`);
  }
}

await writeFile(outputPath, `${JSON.stringify(projection, null, 2)}\n`, 'utf8');
console.log(`QUICKSTART_PROJECTION_SYNCED decisions=${projection.decisionRefs.length} output=${outputPath}`);
