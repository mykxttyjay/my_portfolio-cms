import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

console.log('Post-build script started...');

// The Vercel adapter creates output in .vercel/output/functions/_render.func/
// We need to ensure the structure is correct for Vercel's runtime

const vercelOutputDir = path.join(projectRoot, '.vercel/output/functions/_render.func');
const distServerDir = path.join(vercelOutputDir, 'dist/server');

if (!fs.existsSync(distServerDir)) {
  console.log('⚠ Warning: .vercel/output/functions/_render.func/dist/server not found');
  console.log('  This is expected if using Vercel adapter v10+');
  console.log('  Vercel will handle the deployment structure automatically');
} else {
  console.log('✓ Found Vercel output structure at:', distServerDir);
  
  // List contents for debugging
  try {
    const contents = fs.readdirSync(distServerDir);
    console.log('  Contents:', contents);
  } catch (e) {
    console.log('  Could not read directory contents');
  }
}

console.log('Post-build script completed!');

