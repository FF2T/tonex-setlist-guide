import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // .test.js → env node (rapide, pour scoring/state pur).
    // .test.jsx → env jsdom (pour les tests UI testing-library).
    environmentMatchGlobs: [['src/**/*.test.jsx', 'jsdom']],
    include: ['src/**/*.test.{js,jsx}'],
    globals: false,
    passWithNoTests: true,
  },
});
