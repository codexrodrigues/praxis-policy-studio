import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputPath = resolve('dist/praxis-rules-studio/browser/app-config.json');
const baseUrl = deploymentOrigin(
  process.env.RULES_STUDIO_CONFIG_API_BASE_URL ?? process.env.POLICY_STUDIO_CONFIG_API_BASE_URL
);
const hostProfiles = [{ id: 'quickstart', labelPtBr: 'Quickstart', labelEnUs: 'Quickstart', apiBaseUrl: baseUrl }];
if (process.env.RULES_STUDIO_ERGON_API_BASE_URL !== undefined) {
  const apiBaseUrl = deploymentOrigin(process.env.RULES_STUDIO_ERGON_API_BASE_URL);
  if (apiBaseUrl === baseUrl) throw new Error('POLICY_STUDIO_DUPLICATE_DEPLOYMENT_ORIGIN');
  hostProfiles.push({ id: 'ergon', labelPtBr: 'Ergon', labelEnUs: 'Ergon', apiBaseUrl });
} else if (process.env.POLICY_STUDIO_SECONDARY_API_BASE_URL !== undefined) {
  const apiBaseUrl = deploymentOrigin(process.env.POLICY_STUDIO_SECONDARY_API_BASE_URL);
  if (apiBaseUrl === baseUrl) throw new Error('POLICY_STUDIO_DUPLICATE_DEPLOYMENT_ORIGIN');
  const label = process.env.POLICY_STUDIO_SECONDARY_HOST_LABEL?.trim() || 'Workforce Showcase';
  hostProfiles.push({ id: 'secondary', labelPtBr: label, labelEnUs: label, apiBaseUrl });
}
const current = JSON.parse(await readFile(outputPath, 'utf8'));

if (current.mode !== 'remote') {
  throw new Error('POLICY_STUDIO_STATIC_DEPLOYMENT_REQUIRES_REMOTE_MODE');
}

await writeFile(outputPath, `${JSON.stringify({ ...current, configApiBaseUrl: baseUrl, hostProfiles }, null, 2)}\n`);
console.log(`POLICY_STUDIO_STATIC_DEPLOYMENT_OK backend=${baseUrl}`);

function deploymentOrigin(raw) {
  if (!raw?.trim()) throw new Error('POLICY_STUDIO_CONFIG_API_BASE_URL_REQUIRED');
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error('POLICY_STUDIO_CONFIG_API_BASE_URL_INVALID');
  }
  if (url.protocol !== 'https:' || url.hostname.includes('*') || url.username || url.password || url.pathname !== '/'
      || /[?#]/.test(url.href)) {
    throw new Error('POLICY_STUDIO_CONFIG_API_BASE_URL_MUST_BE_HTTPS_ORIGIN');
  }
  return url.origin;
}
