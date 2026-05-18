import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import emdash from 'emdash/astro';
import { sqlite } from 'emdash/db';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [
    react(),
    emdash({
      database: sqlite({ url: 'file:./data.db' }),
    }),
  ],
});
