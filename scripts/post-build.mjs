import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Copy the server entry point and chunks to the root dist directory
// This is needed because Vercel looks for dist/server/entry.mjs at the root level
const sourceDir = path.join(projectRoot, '.vercel/output/functions/_render.func/dist/server');
const targetDir = path.join(projectRoot, '.vercel/output/dist/server');

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Copy entry.mjs
const entrySource = path.join(sourceDir, 'entry.mjs');
const entryTarget = path.join(targetDir, 'entry.mjs');
if (fs.existsSync(entrySource)) {
  fs.copyFileSync(entrySource, entryTarget);
  console.log('✓ Copied entry.mjs');
}

// Copy virtual_astro_middleware.mjs
const middlewareSource = path.join(sourceDir, 'virtual_astro_middleware.mjs');
const middlewareTarget = path.join(targetDir, 'virtual_astro_middleware.mjs');
if (fs.existsSync(middlewareSource)) {
  fs.copyFileSync(middlewareSource, middlewareTarget);
  console.log('✓ Copied virtual_astro_middleware.mjs');
}

// Copy chunks directory
const chunksSource = path.join(sourceDir, 'chunks');
const chunksTarget = path.join(targetDir, 'chunks');
if (fs.existsSync(chunksSource)) {
  // Remove existing chunks directory if it exists
  if (fs.existsSync(chunksTarget)) {
    fs.rmSync(chunksTarget, { recursive: true, force: true });
  }
  // Copy the entire chunks directory
  fs.cpSync(chunksSource, chunksTarget, { recursive: true });
  console.log('✓ Copied chunks directory');
}

console.log('Post-build script completed successfully!');
