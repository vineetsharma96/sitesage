// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  // A build must not invalidate dependency URLs used by running browser tabs.
  vite: {
    cacheDir: process.env.NODE_ENV === 'production' ? 'node_modules/.vite-build' : 'node_modules/.vite-dev',
  },
});
