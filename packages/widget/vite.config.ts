import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [react(), dts({ insertTypesEntry: true })],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'VirtuOpsWidget',
      formats: ['es'],
      fileName: () => 'widget.es.js',
    },
    rollupOptions: {
      // Sub-paths must be covered too: bundling `react-dom/client` inlines a
      // shim that reaches into react-dom internals and breaks on React 19,
      // while `react-dom` itself stays external.
      external: [/^react($|\/)/, /^react-dom($|\/)/],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
})
