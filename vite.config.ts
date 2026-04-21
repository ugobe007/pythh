import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

/** Injected into dist/index.html so View Source shows which Git commit Vercel built (debug stale deploys). */
function pythhBuildMetaPlugin(): Plugin {
  return {
    name: 'pythh-build-meta',
    transformIndexHtml(html) {
      const sha =
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.GITHUB_SHA ||
        process.env.CF_PAGES_COMMIT_SHA ||
        '';
      if (!sha) return html;
      if (html.includes('name="pythh-build"')) return html;
      return html.replace(/<head>/i, `<head>\n    <meta name="pythh-build" content="${sha}" />`);
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    pythhBuildMetaPlugin(),
    nodePolyfills({
      // Polyfill Buffer, process, global at bundle time so vendor chunks
      // don't explode on Safari / browsers without Node globals.
      protocolImports: true,
    }),
  ],
  define: {
    // Belt-and-suspenders: make sure global / process.env are always defined
    global: 'globalThis',
    'process.env': '{}',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: 'localhost',  // Makes it work at http://localhost:5173
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    // One CSS bundle avoids Vite's dynamic-import CSS preload path that can throw
    // "Unable to preload CSS" in production and leave the app blank (no Supabase data).
    cssCodeSplit: false,
    // Native modulepreload only; avoids legacy polyfill edge cases.
    modulePreload: { polyfill: false },
    sourcemap: false,
    // Target modern browsers — avoids transpiling async/await, arrow functions,
    // optional chaining etc. which Fly.io's audience supports. Smaller output.
    target: 'es2020',
    // Warn when any chunk exceeds 1 MB (helps spot accidental large imports)
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist']
  },
  worker: {
    format: 'es'
  }
});
