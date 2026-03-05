import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://cake.lp.gadandan.co.jp',
  outDir: './dist',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/compare/'),
    }),
  ],
  build: {
    format: 'directory',
  },
});
