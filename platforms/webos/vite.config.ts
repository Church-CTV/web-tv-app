import { defineConfig } from 'vite';
import path from 'path';
import { cspPlugin } from '../../shared/csp.mjs';

export default defineConfig({
  resolve: {
    alias: {
      '@ctv/core': path.resolve(__dirname, '../../core/src'),
      '@ctv/shared': path.resolve(__dirname, '../../shared'),
    },
  },
  plugins: [cspPlugin('webos')],
  build: {
    target: 'es2017',
    cssTarget: 'chrome68',
    minify: 'terser',
    terserOptions: { ecma: 2017, compress: { passes: 3 } },
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
  },
});
