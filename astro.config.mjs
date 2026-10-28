import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://an520.xin',
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        '/admin': {
          target: 'http://127.0.0.1:3210',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/admin/, ''),
        },
      },
    },
  },
});
