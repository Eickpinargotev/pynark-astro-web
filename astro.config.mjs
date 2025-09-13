import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import node from '@astrojs/node';

export default defineConfig({
  integrations: [tailwind(), react()],
  output: 'server',
  adapter: node({
    // standalone para empaquetar dependencias en dist y ejecutar con `node dist/server/entry.mjs`
    mode: 'standalone'
  }),
  build: {
    assets: 'assets'
  }
});
