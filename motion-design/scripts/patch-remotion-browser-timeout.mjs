import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  path.join(root, 'node_modules', '@remotion', 'renderer', 'dist', 'open-browser.js'),
  path.join(root, 'node_modules', '@remotion', 'renderer', 'dist', 'esm', 'index.mjs'),
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, 'utf8');
  const after = before
    .replace(/timeout: 25000,/g, 'timeout: 300000,')
    .replace(/timeout: 120000,/g, 'timeout: 300000,');
  if (after !== before) fs.writeFileSync(file, after);
}

console.log('Remotion browser startup timeout: 300000ms');
