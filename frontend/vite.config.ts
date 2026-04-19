import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET || 'http://localhost:4000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: env.VITE_PROXY_TARGET || 'http://localhost:4000',
          ws: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
    },
  };
});
