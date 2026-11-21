import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { scramjetPath } from '@mercuryworkshop/scramjet/path';
import { controllerPath } from '@mercuryworkshop/scramjet-controller/path';

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      structured: false,
      targets: [
        { src: scramjetPath + '/*', dest: 'scramjet' },
        { src: controllerPath + '/*', dest: 'controller' },
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
