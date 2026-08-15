import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const proxy = JSON.parse(readFileSync(new URL('../proxy.conf.json', import.meta.url), 'utf8'));

const start = packageJson.scripts?.start ?? '';
if (!start.includes('--port 4302') || !start.includes('--proxy-config proxy.conf.json')) {
  throw new Error('npm start must use the official port 4302 and the versioned same-origin proxy');
}

for (const route of ['/api', '/auth', '/schemas']) {
  const entry = proxy[route];
  if (entry?.target !== 'http://127.0.0.1:8088' || entry.secure !== false || entry.changeOrigin !== false) {
    throw new Error(`${route} must target the official Quickstart origin without rewriting Origin`);
  }
}

console.log('POLICY_STUDIO_LOCAL_RUNTIME_OK port=4302 backend=127.0.0.1:8088');
