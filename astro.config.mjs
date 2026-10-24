import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://an520.xin',
  vite: { plugins: [tailwindcss()] },
});
