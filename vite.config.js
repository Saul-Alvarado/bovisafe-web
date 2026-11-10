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
  plugins: [react()],
  base,
  server: { host: '0.0.0.0' }
})
