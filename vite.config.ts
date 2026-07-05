import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Strip the `crossorigin` attribute Vite puts on the built <script>/<link> tags.
// On an access-controlled (private) GitHub Pages site those anonymous, no-credential
// asset requests get a 403, so the app never boots — a blank white page. Removing
// crossorigin lets the assets load with the page's own session. Harmless elsewhere.
function stripCrossorigin(): Plugin {
  return {
    name: 'strip-crossorigin',
    enforce: 'post',
    transformIndexHtml: (html) => html.replace(/ crossorigin/g, ''),
  };
}

// Vite configuration for the LUDUS local game. No server, no network calls.
// `base: './'` makes built asset paths relative, so the same bundle works when
// served from a domain root (Vercel/Netlify) OR a subpath like GitHub Pages'
// https://<user>.github.io/scifi-ludus/.
export default defineConfig({
  base: './',
  plugins: [react(), stripCrossorigin()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
