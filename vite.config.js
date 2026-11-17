import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages sirve los sitios de proyecto desde /nombre-del-repositorio/.
// En desarrollo local usamos /, y en GitHub Actions se ajusta automáticamente.
const owner = process.env.GITHUB_REPOSITORY_OWNER || ''
const repository = process.env.GITHUB_REPOSITORY?.split('/')[1] || ''
const isAccountSite = repository.toLowerCase() === `${owner}.github.io`.toLowerCase()
const base = process.env.GITHUB_ACTIONS === 'true' && repository && !isAccountSite
  ? `/${repository}/`
  : '/'

export default defineConfig({
  plugins: [react(), {
    name: 'runtime-config',
    configureServer(server) {
      server.middlewares.use('/runtime-config', (_req, res) => {
        res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify({ apiUrl: process.env.BOVISAFE_API_URL || process.env.VITE_API_URL || '/api' }))
      })
    }
  }],
  base,
  server: { host: '0.0.0.0', proxy: { '/api': { target: process.env.BOVISAFE_PROXY_TARGET || 'http://127.0.0.1:8080', changeOrigin: true } } }
})
