import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import emdash from 'emdash/astro';
import { sqlite } from 'emdash/db';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
  }),
  integrations: [
    react(),
    emdash({
      database: sqlite({ 
        url: `file:${path.join(__dirname, '.emdash', 'data.db')}` 
      }),
    }),
  ],
});
