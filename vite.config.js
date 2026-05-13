import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: 'src',
  base: './',
  // Phase 7.8 — public/ existe pour servir sw.js depuis l'origine du site
  // (au lieu d'un blob URL qui n'a pas de scope sur la page). Les fichiers
  // sont copiés verbatim dans dist/, vite-plugin-singlefile ne les inline pas.
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
  plugins: [react(), viteSingleFile()],
});
