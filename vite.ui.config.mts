import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'

export default defineConfig({
  root: 'ui',
  server: { port: 3000 },
  plugins: [
    svgr(),
    react(),
    tailwindcss(),
    legacy({
      modernTargets: ['edge>=109', 'safari>=14'],
      renderLegacyChunks: false,
      modernPolyfills: ['es.object.has-own', 'web.structured-clone'],
      additionalModernPolyfills: [
        path.resolve('./src/polyfills/matchMedia.js'),
        path.resolve('./src/polyfills/WeakRef.js'),
        path.resolve('./src/polyfills/RegExp.js'),
      ],
    }),
  ],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
    rolldownOptions: {
      input: {
        main: path.resolve('./ui/index.html'),
        'quick-panel': path.resolve('./ui/quick-panel.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve('./src'),
      '@ui': path.resolve('./ui'),
      '@root': path.resolve('.'),
      'monaco-editor/esm/vs/editor/editor.worker.js':
        'monaco-editor/editor/editor.worker',
    },
  },
  define: {
    OS_PLATFORM: `"${process.platform}"`,
  },
})
