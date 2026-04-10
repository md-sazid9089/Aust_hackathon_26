import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    port: 5173,
    // Proxy API calls to backend during development
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/health': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
      '/route': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
      '/graph': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
});
