import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** Même codebase que Core web — zéro duplication UI. */
const coreRoot = path.resolve(__dirname, '../orion-core')

export default defineConfig({
  root: coreRoot,
  base: './',
  envDir: path.resolve(__dirname),
  publicDir: path.join(coreRoot, 'public'),
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5175,
    strictPort: true,
    fs: {
      allow: [coreRoot, path.resolve(__dirname)],
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
})
