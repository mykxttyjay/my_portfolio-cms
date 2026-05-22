import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
  }),
  integrations: [react()],
  vite: {
    plugins: [
      {
        name: 'emdash-virtual-modules',
        resolveId(id) {
          if (id.startsWith('virtual:emdash/')) {
            return '\0' + id;
          }
        },
        load(id) {
          if (id.startsWith('\0virtual:emdash/')) {
            return `export default {};`;
          }
        },
      },
    ],
    ssr: {
      noExternal: ['emdash'],
    },
  },
});
