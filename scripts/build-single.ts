// Sinh dist-single/worker.js: một file duy nhất (API + giao diện) để dán vào editor Worker trên dashboard.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

const assets: Record<string, string> = { '/index.html': readFileSync('dist/index.html', 'utf8') };
for (const f of readdirSync('dist/assets')) assets[`/assets/${f}`] = readFileSync(join('dist/assets', f), 'utf8');
writeFileSync('src/server/_assets.gen.js', `export const ASSETS = ${JSON.stringify(assets)};\n`);
mkdirSync('dist-single', { recursive: true });
await build({
  entryPoints: ['src/server/worker-single.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  conditions: ['workerd', 'worker', 'browser'],
  minify: true,
  outfile: 'dist-single/worker.js',
  legalComments: 'none',
});
console.log('dist-single/worker.js', readFileSync('dist-single/worker.js').length, 'bytes');
