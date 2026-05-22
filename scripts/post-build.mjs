import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

console.log('Post-build script started...');

// The Vercel adapter creates the output in .vercel/output/functions/_render.func
// We need to ensure the entry.mjs is accessible at the root level for Vercel's runtime

const renderFuncDir = path.join(projectRoot, '.vercel/output/functions/_render.func');
const distServerDir = path.join(projectRoot, '.vercel/output/functions/_render.func/dist/server');

if (fs.existsSync(distServerDir)) {
  console.log('✓ Found Vercel render function directory');
  
  // List files in the dist/server directory for debugging
  const files = fs.readdirSync(distServerDir);
  console.log('Files in dist/server:', files);
} else {
  console.log('⚠ Vercel render function directory not found at:', distServerDir);
  console.log('This is expected in local development. Vercel will handle this during deployment.');
}

console.log('Post-build script completed successfully!');
