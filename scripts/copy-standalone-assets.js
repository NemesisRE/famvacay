const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const standaloneDir = path.join(rootDir, '.next', 'standalone');

if (!fs.existsSync(standaloneDir)) {
  console.log('[standalone-assets] .next/standalone does not exist, skipping.');
  process.exit(0);
}

// 1. Copy .next/static -> .next/standalone/.next/static
const srcStatic = path.join(rootDir, '.next', 'static');
const destStatic = path.join(standaloneDir, '.next', 'static');

if (fs.existsSync(srcStatic)) {
  fs.mkdirSync(path.dirname(destStatic), { recursive: true });
  fs.cpSync(srcStatic, destStatic, { recursive: true });
  console.log(`[standalone-assets] Copied ${srcStatic} -> ${destStatic}`);
}

// 2. Copy public -> .next/standalone/public
const srcPublic = path.join(rootDir, 'public');
const destPublic = path.join(standaloneDir, 'public');

if (fs.existsSync(srcPublic)) {
  fs.mkdirSync(destPublic, { recursive: true });
  fs.cpSync(srcPublic, destPublic, { recursive: true });
  console.log(`[standalone-assets] Copied ${srcPublic} -> ${destPublic}`);
}

console.log('[standalone-assets] Standalone static assets setup complete.');

