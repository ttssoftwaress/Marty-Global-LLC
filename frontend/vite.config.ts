import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/*
 * The identity of this build, written into the bundle and published beside it
 * as /version.json. The running app polls that file and reloads itself when the
 * two disagree, so a release reaches open tabs without anyone refreshing
 * (src/lib/app-version.ts).
 *
 * The release workflow sets VITE_SENTRY_RELEASE to the commit SHA, which makes
 * the id the same thing Sentry already groups by. The timestamp is only for
 * local `npm run build`.
 */
const buildId = process.env.VITE_SENTRY_RELEASE || `local-${Date.now()}`

function versionManifest(): Plugin {
  return {
    name: 'marty-version-manifest',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        // Not under /assets — that path is served immutable for a year, and this
        // file has to be read fresh on every poll.
        fileName: 'version.json',
        source: JSON.stringify({ build: buildId }),
      })
    },
  }
}

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [react(), tailwindcss(), versionManifest()],
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
