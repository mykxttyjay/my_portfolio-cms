import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// ✅ SAFE STATIC CONFIG (for Vercel + portfolio)
export default defineConfig({
  output: 'static',

  integrations: [react()],

  // ❌ REMOVE all server/Vercel/EmDash SSR hacks
  vite: {
    ssr: {
      noExternal: [],
    },
  },
});