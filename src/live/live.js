import { useCallback, useEffect, useRef, useState } from 'react'

/** Content key that ignores fields which change on every response (generatedAt). */
export function fingerprint(value, ignore = ['generatedAt']) {
  const skip = new Set(ignore)
  return JSON.stringify(value ?? null, (key, v) => (skip.has(key) ? undefined : v))
}

export class HttpError extends Error {
  constructor(message, status) { super(message); this.status = status }
}

async function readError(response, fallback) {
  let message
  try { message = (await response.json()).message } catch { /* not JSON */ }
  if (response.status === 401) message = 'Tu sesión terminó. Inicia sesión nuevamente para consultar la información privada.'
  if (response.status === 404 && !message) message = 'El servicio no está disponible en este servidor.'
  return new HttpError(message || `${fallback} (${response.status})`, response.status)
}

// Identical GETs issued at the same time (observatory, map inventory and reports) share one request.
const inflight = new Map()
export function getJson(url, { token, signal, fallback = 'No se pudo consultar la información' } = {}) {
  const key = `${token || ''} ${url}`
  let entry = inflight.get(key)
  if (!entry) {
    const controller = new AbortController()
    const promise = fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal, cache: 'no-store' })
      .then(async r => { if (!r.ok) throw await readError(r, fallback); return r.json() })
      .finally(() => { if (inflight.get(key) === entry) inflight.delete(key) })
    entry = { promise, controller, users: 0 }
    inflight.set(key, entry)
  }
  entry.users++
  const current = entry
  return new Promise((resolve, reject) => {
    let settled = false
    const release = () => { if (!settled) { settled = true; if (--current.users === 0) { current.controller.abort(); if (inflight.get(key) === current) inflight.delete(key) } } }
    const onAbort = () => { release(); reject(new DOMException('Consulta cancelada', 'AbortError')) }
    if (signal) { if (signal.aborted) return onAbort(); signal.addEventListener('abort', onAbort, { once: true }) }
    current.promise.then(
      value => { if (!settled) { settled = true; current.users--; signal?.removeEventListener('abort', onAbort); resolve(value) } },
      error => { if (!settled) { settled = true; current.users--; signal?.removeEventListener('abort', onAbort); reject(error) } },
    )
  })
}

const pageVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden'
const networkOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false
/** Tests may shorten the cycle; production never polls faster than every 5 seconds. */
const configuredInterval = fallback => {
  const custom = typeof window !== 'undefined' ? Number(window.__BOVISAFE_REFRESH_MS__) : NaN
  return Number.isFinite(custom) && custom > 0 ? Math.max(custom, typeof window !== 'undefined' && window.__BOVISAFE_TEST__ ? 200 : 5000) : fallback
}

/**
 * Periodic background refresh: one tick per interval while the tab is visible and online,
 * an immediate tick when the tab becomes visible again or the connection returns,
 * no tick while a refresh is still running, and a moderate back-off after failures.
 */
export function useAutoRefresh({ intervalMs = 60000, maxMs = 300000 } = {}) {
  const interval = configuredInterval(intervalMs)
  const [tick, setTick] = useState(0)
  const [visible, setVisible] = useState(pageVisible)
  const [online, setOnline] = useState(networkOnline)
  const [failures, setFailures] = useState(0)
  const ref = useRef({ pending: 0, last: Date.now(), failures: 0 })

  const fire = useCallback(() => {
    if (ref.current.pending > 0 || !pageVisible() || !networkOnline()) return
    ref.current.last = Date.now()
    setTick(t => t + 1)
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      const now = pageVisible(); setVisible(now)
      if (now && Date.now() - ref.current.last > Math.min(interval, 15000)) fire()
    }
    const onOnline = () => { setOnline(true); fire() }
    const onOffline = () => setOnline(false)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => { document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [fire, interval])

  useEffect(() => {
    if (!visible || !online) return
    let timer
    const loop = () => {
      const delay = Math.min(maxMs, interval * 2 ** ref.current.failures)
      timer = setTimeout(() => { fire(); loop() }, delay)
    }
    loop()
    return () => clearTimeout(timer)
  }, [visible, online, interval, maxMs, fire, failures])

  /** Wraps a refresh so ticks never overlap it and failures slow the cycle down. */
  const track = useCallback(promise => {
    ref.current.pending++
    return promise.then(
      value => { if (ref.current.failures) { ref.current.failures = 0; setFailures(0) } return value },
      error => { if (error?.name !== 'AbortError') { ref.current.failures = Math.min(ref.current.failures + 1, 3); setFailures(ref.current.failures) } throw error },
    ).finally(() => { ref.current.pending-- })
  }, [])

  return { tick, visible, online, failures, active: visible && online, track, intervalMs: interval }
}

export const clockTime = date => date ? new Date(date).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Mexico_City' }) : ''
