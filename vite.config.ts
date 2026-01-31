import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        translate: resolve(__dirname, 'translate.html'),
        saved: resolve(__dirname, 'saved.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
    target: 'es2022',
    minify: false, // Easier debugging for extension
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
