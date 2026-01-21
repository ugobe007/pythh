import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
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
    // Ensure no HMR in production
    sourcemap: false, // Disable sourcemaps for production
    rollupOptions: {
      output: {
        // Disable manual chunking - let Vite handle it automatically
        // This prevents circular dependency issues with React internals
      },
    },
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist']
  },
  worker: {
    format: 'es'
  }
});
