// Measures a build directory and prints DATA-only JSON to stdout:
//   { "uncompressedSize": <bytes>, "compressedSize": <gzip bytes> }
//
// This script runs inside the unprivileged "Measure bundle size" workflow,
// which executes untrusted PR code with a read-only token. Its ONLY output is
// numeric measurements — never anything that later flows into code execution or
// into the commit-status target. Keep it dependency-free.
//
// Usage: node bundle-size/measure.js <build-dir>

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node bundle-size/measure.js <build-dir>');
  process.exit(1);
}

let uncompressedSize = 0;
let compressedSize = 0;

function walk(current) {
  for (const entry of readdirSync(current)) {
    const full = join(current, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walk(full);
    } else if (stats.isFile()) {
      const content = readFileSync(full);
      uncompressedSize += content.length;
      compressedSize += gzipSync(content).length;
    }
  }
}

walk(dir);

process.stdout.write(JSON.stringify({ uncompressedSize, compressedSize }));
