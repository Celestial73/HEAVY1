import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/HEAVY1/' : '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api/callback': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
