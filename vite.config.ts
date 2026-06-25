import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration for the LUDUS local game. No server, no network calls.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
