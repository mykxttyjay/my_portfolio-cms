import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Check if we're in a Vercel environment
const isVercel = process.env.VERCEL === '1';

if (isVercel) {
  console.log('Running in Vercel environment...');
  
  // The .vercel/output structure is created by Astro's Vercel adapter
  // No additional copying is needed - Vercel handles the file structure
  console.log('✓ Vercel adapter will handle the output structure');
} else {
  console.log('Running in local environment - skipping Vercel-specific post-build steps');
}

console.log('Post-build script completed successfully!');
