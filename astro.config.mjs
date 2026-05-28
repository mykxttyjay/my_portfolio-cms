import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  server: {
    host: true,
    port: Number(process.env.PORT) || 3000
  },
  integrations: [react()],
});