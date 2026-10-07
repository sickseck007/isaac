import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
          if (id.endsWith('/data/items.json')) return 'item-catalogue';
          if (id.endsWith('/data/referenceIndex.json')) return 'reference-index';
        },
      },
    },
  },
});
