import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // The backend's CORS allowlist pins this exact origin — drifting to 5174
    // would silently break every API call.
    strictPort: true,
    // Vite rejects requests whose Host header it doesn't recognize (DNS-rebinding
    // guard). Tunnels arrive with the tunnel's hostname, so allow them through.
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.app', '.ngrok.io'],
    // Tunnelling exposes this dev server only — the backend stays on localhost.
    // Proxying keeps the API same-origin as the app, so one tunnel is enough and
    // CORS/cookies behave exactly as they do in production behind the reverse
    // proxy. `ws: true` covers the live-chat Socket.IO upgrade.
    proxy: {
      '/v1': { target: 'http://localhost:4000', changeOrigin: true },
      '/api/auth': { target: 'http://localhost:4000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:4000', changeOrigin: true, ws: true },
    },
  },
})
