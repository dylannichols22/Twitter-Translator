import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const target = process.argv[2] || 'v2';
const source = resolve(`manifest.${target}.json`);
const dest = resolve('dist', 'manifest.json');

if (!existsSync(source)) {
  console.error(`Manifest not found: ${source}`);
  process.exit(1);
}

copyFileSync(source, dest);
console.log(`Copied ${source} -> ${dest}`);
