import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Large third-party libraries go into their own chunks so the app's own code stays small
// and the browser can cache the libraries separately.
const vendorChunks: Record<string, string[]> = {
  firebase: ['firebase/', '@firebase/'],
  supabase: ['@supabase/'],
  react: ['react/', 'react-dom/', 'react-router', 'scheduler'],
};

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          for (const [name, packages] of Object.entries(vendorChunks)) {
            if (packages.some((pkg) => id.includes(`/node_modules/${pkg}`))) return name;
          }
          return undefined;
        },
      },
    },
  },
  preview: {
    // Matches the dev server's SPA behavior so refreshing deep links works locally too.
    port: 4173,
  },
});
