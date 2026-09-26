import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    force: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['@remixicon/react', 'clsx', 'tailwind-merge'],
          'vendor-db': ['dexie', 'minisearch', 'jalaali-js'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api/unsplash': {
        target: 'https://unsplash.com/napi',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/unsplash/, ''),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
      },
    },
  },
});
