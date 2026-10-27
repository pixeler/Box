import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Resolves the owning package name for a module id, including pnpm's nested
 * layout (`node_modules/.pnpm/pkg@ver/node_modules/pkg/...`). Matching on the
 * exact package name avoids the classic `/react/` substring trap, where
 * `@blocknote/react` or `react-dom` get pulled into the React chunk.
 */
function packageNameOf(id: string): string {
  const normalized = id.replace(/\\/g, '/');
  const marker = 'node_modules/';
  const index = normalized.lastIndexOf(marker);
  if (index === -1) return '';

  const segments = normalized.slice(index + marker.length).split('/');
  const [first, second] = segments;
  if (!first) return '';
  return first.startsWith('@') ? `${first}/${second ?? ''}` : first;
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    // Modern targets only: this ships to Android WebView / a Windows shell, so
    // legacy transpilation is dead weight.
    target: 'esnext',
    cssCodeSplit: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        /**
         * Keep the boot graph small. React, Supabase, icons and the local DB
         * layer each get their own long-lived chunk, so a cold start only has
         * to parse what the first screen actually renders. Heavy views
         * (calendar, notebook, editor) stay as dynamic chunks.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          const pkg = packageNameOf(id);
          if (!pkg) return undefined;

          if (pkg === 'react' || pkg === 'react-dom' || pkg === 'scheduler') return 'vendor-react';
          if (pkg.startsWith('@supabase/')) return 'vendor-supabase';
          // Dexie and the Jalali calendar are on the first-paint path, so they
          // get a stable chunk. MiniSearch is deliberately *not* listed here:
          // it is only used by the search overlay, and grouping it with the DB
          // would drag it back into the boot payload.
          if (pkg === 'dexie' || pkg === 'jalaali-js') return 'vendor-db';
          if (
            pkg === '@remixicon/react' ||
            pkg === 'lucide-react' ||
            pkg === '@carbon/icons-react' ||
            pkg.startsWith('@hugeicons/')
          ) {
            return 'vendor-icons';
          }
          if (pkg.startsWith('@radix-ui/') || pkg.startsWith('@base-ui/')) return 'vendor-ui';

          return undefined;
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
