import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProjection } from './projection-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['public/projections/ergonx-rn013.v1.json', 'public/projections/quickstart-benefit-eligibility.v1.json'];
for (const file of files) {
  const projection = JSON.parse(await readFile(path.join(root, file), 'utf8'));
  const errors = validateProjection(projection);
  if (errors.length) throw new Error(`${file}: ${errors.join(',')}`);
}
console.log(`POLICY_STUDIO_PROJECTIONS_OK count=${files.length}`);

