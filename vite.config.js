import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Blocked request. This host ("1d705853c0fa.ngrok-free.app") is not allowed.
//To allow this host, add "1d705853c0fa.ngrok-free.app" to `server.allowedHosts` in vite.config.js.
  server: {
    allowedHosts: ['1d705853c0fa.ngrok-free.app','43020fc36ad2.ngrok-free.app']
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
