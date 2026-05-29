import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import emdash, { local } from 'emdash/astro';
import { sqlite } from 'emdash/db';

const storageDir = process.env.PERSISTENT_STORAGE_DIR;
const dbPath = storageDir ? path.join(storageDir, 'data.db') : './data.db';
const uploadsDir = storageDir ? path.join(storageDir, 'uploads') : './uploads';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),

  server: {
    host: true,
    port: Number(process.env.PORT) || 3000
  },

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [
    react(),
    emdash({
      siteUrl: process.env.SITE_URL,
      database: sqlite({ url: `file:${dbPath}` }),
      storage: local({
        directory: uploadsDir,
        baseUrl: '/_emdash/api/media/file'
      })
    })
  ]
});
