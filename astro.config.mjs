import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://baken.ca',
  output: 'static',
  build: {
    format: 'directory',
  },
});
