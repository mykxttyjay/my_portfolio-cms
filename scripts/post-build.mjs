import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

console.log('Post-build script started...');

// The Vercel adapter creates output in .vercel/output/functions/_render.func/dist/server
// But Vercel's runtime looks for it at /var/task/dist/server
// We need to copy the entry file to the root dist directory

const sourceDir = path.join(projectRoot, '.vercel/output/functions/_render.func/dist/server');
const targetDir = path.join(projectRoot, 'dist/server');

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log('✓ Created dist/server directory');
}

// Copy entry.mjs
const entrySource = path.join(sourceDir, 'entry.mjs');
const entryTarget = path.join(targetDir, 'entry.mjs');
if (fs.existsSync(entrySource)) {
  fs.copyFileSync(entrySource, entryTarget);
  console.log('✓ Copied entry.mjs to dist/server/');
} else {
  console.log('⚠ entry.mjs not found at:', entrySource);
}

// Copy virtual_astro_middleware.mjs
const middlewareSource = path.join(sourceDir, 'virtual_astro_middleware.mjs');
const middlewareTarget = path.join(targetDir, 'virtual_astro_middleware.mjs');
if (fs.existsSync(middlewareSource)) {
  fs.copyFileSync(middlewareSource, middlewareTarget);
  console.log('✓ Copied virtual_astro_middleware.mjs to dist/server/');
}

// Copy chunks directory
const chunksSource = path.join(sourceDir, 'chunks');
const chunksTarget = path.join(targetDir, 'chunks');
if (fs.existsSync(chunksSource)) {
  if (fs.existsSync(chunksTarget)) {
    fs.rmSync(chunksTarget, { recursive: true, force: true });
  }
  fs.cpSync(chunksSource, chunksTarget, { recursive: true });
  console.log('✓ Copied chunks directory to dist/server/');
}

console.log('Post-build script completed successfully!');
