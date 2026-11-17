export function getApiBase() {
  const value = window.__BOVISAFE_CONFIG__?.apiUrl || import.meta.env.VITE_API_URL || '/api'
  const url = new URL(value, window.location.origin)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('URL de API no válida')
  if (window.location.protocol === 'https:' && url.protocol !== 'https:') throw new Error('La API de producción requiere HTTPS')
  return value.replace(/\/$/, '')
}
