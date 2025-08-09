import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Blocked request. This host ("1d705853c0fa.ngrok-free.app") is not allowed.
//To allow this host, add "1d705853c0fa.ngrok-free.app" to `server.allowedHosts` in vite.config.js.
  server: {
    allowedHosts: true, // Allow all hosts ,use with caution
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
