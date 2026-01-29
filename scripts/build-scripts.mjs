import { build } from 'esbuild';
import { resolve } from 'node:path';

const target = process.argv[2] || 'v2';
const format = target === 'v3' ? 'esm' : 'iife';
const entryPoints = [
  { name: 'background', path: resolve('src', 'background.ts') },
  { name: 'content', path: resolve('src', 'content.ts') },
];

for (const entry of entryPoints) {
  await build({
    entryPoints: [entry.path],
    bundle: true,
    format,
    platform: 'browser',
    target: 'es2022',
    minify: false,
    outfile: resolve('dist', `${entry.name}.js`),
    globalName: `${entry.name}Bundle`,
  });
}

console.log(`Built extension scripts (${format})`);
