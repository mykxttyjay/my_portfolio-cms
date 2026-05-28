export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),

  server: {
    host: true,
    port: Number(process.env.PORT) || 3000
  },

  integrations: [react(), emdash()],

  vite: {
    ssr: {
      external: ['emdash']
    }
  }
});