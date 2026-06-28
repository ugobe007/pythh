import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

/** Production UI: site/ (pythh.ai). Legacy frontend remains under src/ (not built). */
const siteRoot = path.resolve(__dirname, 'site');
const repoPublic = path.resolve(__dirname, 'public');

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
  root: siteRoot,
  publicDir: repoPublic,
  plugins: [
    react(),
    pythhBuildMetaPlugin(),
    nodePolyfills({
      protocolImports: true,
    }),
  ],
  define: {
    global: 'globalThis',
    'process.env': '{}',
  },
  resolve: {
    alias: {
      '@': siteRoot,
      '@shared': path.join(siteRoot, 'shared'),
    },
  },
  server: {
    host: 'localhost',
    proxy: {
      // DEV-ONLY: pointed at local backend so the new named-match cards render in review.
      // Revert to https://hot-honey.fly.dev before committing.
      '/api/hero-preview': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    // Default `dist` is relative to `root`, which would be site/dist — Vercel + Fly expect repo-root dist/.
    outDir: path.resolve(__dirname, 'dist'),
    cssCodeSplit: false,
    modulePreload: { polyfill: false },
    sourcemap: false,
    target: 'es2020',
    chunkSizeWarningLimit: 1000,
    emptyOutDir: true,
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
  worker: {
    format: 'es',
  },
});
