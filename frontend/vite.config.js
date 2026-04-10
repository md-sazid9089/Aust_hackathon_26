import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    port: 5173,
    // Proxy API calls to backend during development
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/health': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/route': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/graph': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
});
