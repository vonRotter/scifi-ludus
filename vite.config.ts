import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration for the LUDUS local game. No server, no network calls.
// `base: './'` makes built asset paths relative, so the same bundle works when
// served from a domain root (Vercel/Netlify) OR a subpath like GitHub Pages'
// https://<user>.github.io/scifi-ludus/.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
