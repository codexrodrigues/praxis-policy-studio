import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputPath = resolve('dist/praxis-policy-studio/browser/app-config.json');
const baseUrl = deploymentOrigin(process.env.POLICY_STUDIO_CONFIG_API_BASE_URL);
const current = JSON.parse(await readFile(outputPath, 'utf8'));

if (current.mode !== 'remote') {
  throw new Error('POLICY_STUDIO_STATIC_DEPLOYMENT_REQUIRES_REMOTE_MODE');
}

await writeFile(outputPath, `${JSON.stringify({ ...current, configApiBaseUrl: baseUrl }, null, 2)}\n`);
console.log(`POLICY_STUDIO_STATIC_DEPLOYMENT_OK backend=${baseUrl}`);

function deploymentOrigin(raw) {
  if (!raw?.trim()) throw new Error('POLICY_STUDIO_CONFIG_API_BASE_URL_REQUIRED');
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error('POLICY_STUDIO_CONFIG_API_BASE_URL_INVALID');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/'
      || url.search || url.hash) {
    throw new Error('POLICY_STUDIO_CONFIG_API_BASE_URL_MUST_BE_HTTPS_ORIGIN');
  }
  return url.origin;
}
