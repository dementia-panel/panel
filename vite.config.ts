import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxy = {
    target: env.BACKEND_URL || 'http://127.0.0.1:8080',
    changeOrigin: true,
    ...(env.BACKEND_PUBLIC_URL ? { headers: { origin: env.BACKEND_PUBLIC_URL } } : {}),
  }
  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '127.0.0.1',
      ...(env.DEV_TLS_CERT && env.DEV_TLS_KEY
        ? {
            https: { cert: readFileSync(env.DEV_TLS_CERT), key: readFileSync(env.DEV_TLS_KEY) },
          }
        : {}),
      proxy: { '/api': proxy, '/healthz': proxy, '/readyz': proxy, '/s/': proxy },
    },
  }
})
