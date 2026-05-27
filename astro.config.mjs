import node from '@astrojs/node';
import react from '@astrojs/react';
import { defineConfig } from 'astro/config';
import emdash, { local } from 'emdash/astro';
import { sqlite } from 'emdash/db';
import path from 'node:path';

const storageDir = process.env.PERSISTENT_STORAGE_DIR;
const dbUrl = storageDir
  ? `file:${path.join(storageDir, 'data.db')}`
  : 'file:./data.db';
const uploadsDir = storageDir
  ? path.join(storageDir, 'uploads')
  : './uploads';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [
    react(),
    emdash({
      database: sqlite({ url: dbUrl }),
      storage: local({
        directory: uploadsDir,
        baseUrl: '/_emdash/api/media/file',
      }),
    }),
  ],
  devToolbar: { enabled: false },
});
