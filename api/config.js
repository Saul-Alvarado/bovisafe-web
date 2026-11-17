export default function handler(_req, res) {
  const apiUrl = process.env.BOVISAFE_API_URL || process.env.VITE_API_URL
  if (!apiUrl) return res.status(503).json({ message: 'Configura BOVISAFE_API_URL en Vercel' })
  try {
    const url = new URL(apiUrl)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('invalid')
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ apiUrl: url.toString().replace(/\/$/, '') })
  } catch { return res.status(503).json({ message: 'La URL de API debe usar HTTPS' }) }
}
