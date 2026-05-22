import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless';
import react from '@astrojs/react';

export default defineConfig({
  output: 'static',

  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
  }),

  integrations: [react()],

  vite: {
    ssr: {
      noExternal: ['emdash', '@emdash-cms/auth'],
    },
  },
});