import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tanstackStart(),
    react(),
  ],
  server: {
    port: 3000,
  },
})
