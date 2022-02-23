import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react(), viteCommonjs()],
  optimizeDeps: {
    include: ['attr-accept']
  },
  server: {
    proxy: {
      '/cockpit/login': 'http://localhost:9090',
      '/cockpit/socket': {
        target: 'ws://localhost:9090',
        ws: true
      }
    }
  }
})
