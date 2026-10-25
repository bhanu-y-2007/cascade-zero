import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.indexOf('node_modules') === -1) return undefined;
          if (id.indexOf('/recharts/') !== -1 || id.indexOf('/d3-') !== -1) return 'charts';
          if (id.indexOf('/react-leaflet/') !== -1 || id.indexOf('/leaflet/') !== -1) return 'maps';
          if (id.indexOf('/lucide-react/') !== -1) return 'icons';
          if (id.indexOf('/react/') !== -1 || id.indexOf('/react-dom/') !== -1 || id.indexOf('/scheduler/') !== -1) return 'react-vendor';
          return undefined;
        },
      },
    },
  },
});
