import { defineConfig } from 'vite';

export default defineConfig({
  base: '/tideline/',
  plugins: [],
  build: {
    target: 'es2022',
  },
  server: {
    // Finer performance.now() resolution where the browser honors it.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
