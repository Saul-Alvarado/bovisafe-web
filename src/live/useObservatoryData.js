import { useEffect, useRef, useState } from 'react'
import { getJson, fingerprint } from './live.js'
import { combineRegionRows, wholeMunicipalities, ranchInRegion } from '../territory/regions.js'

/** Additive per municipality: every bovine, ranch and case belongs to exactly one municipality. */
export const OBSERVATORY_KEYS = ['evaluations', 'animals', 'ranches', 'nws_predictions', 'nws_animals', 'suspected_animals', 'confirmed_animals', 'follow_up_animals', 'suspected_cases', 'confirmed_cases', 'follow_up_cases', 'closed_cases', 'registered_animals']
const sum = (rows, keys) => Object.fromEntries(keys.map(k => [k, rows.reduce((t, r) => t + Math.max(0, Number(r[k]) || 0), 0)]))
const query = params => new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()

function regionLevel(all, declared, region) {
  if (!all) return all
  const whole = wholeMunicipalities(region)
  const rows = combineRegionRows(all.municipalities, declared?.municipalities, region)
  const inWhole = f => whole.has(String(f.properties?.municipality ?? ''))
  const features = [...(all.map?.features || []).filter(inWhole), ...(declared?.map?.features || []).filter(f => !inWhole(f))]
  return { ...all, municipalities: rows, summary: { ...all.summary, ...sum(rows, OBSERVATORY_KEYS) }, map: { type: 'FeatureCollection', features }, unlocatedRanches: null, regionScope: region, chartsScope: 'state' }
}

/**
 * Territorial region = municipalities that wholly belong to it (official catalog) plus ranches whose
 * owner declared it. The server filters by declared region only, so both answers are combined here.
 */
export function combineSnapshot(all, declared, region, municipality) {
  if (!region || !all) return all
  if (municipality) {
    const base = wholeMunicipalities(region).has(municipality) ? all : (declared || all)
    return { ...base, regionScope: region, territorial: regionLevel(all.territorial, declared?.territorial, region) }
  }
  return regionLevel(all, declared, region)
}

function inventoryFor(token, region, all, declared) {
  if (!all) return null
  if (token) return { kind: 'private', rows: (all.rows || []).filter(r => ranchInRegion(region, r.municipality_code, r.region)) }
  return { kind: 'public', rows: region ? combineRegionRows(all.rows, declared?.rows, region) : all.rows }
}

const optional = promise => promise ? promise.catch(e => { if (e.name === 'AbortError') throw e; return null }) : Promise.resolve(null)

export async function loadObservatory({ api, token, filters, signal }) {
  const { region, municipality } = filters
  const period = { from: filters.from, to: filters.to, month: filters.month }
  const base = { ...period, category: filters.category, followUp: filters.followUp, municipality }
  const path = `${api}/observatory${token ? '/authorized' : ''}`
  const options = { token, signal, fallback: 'No se pudo consultar el observatorio' }
  const inventoryPath = token ? `${api}/reports/ranches` : `${api}/reports/municipalities`
  const [all, declared, inventory, inventoryDeclared] = await Promise.all([
    getJson(`${path}?${query(base)}`, options),
    region ? getJson(`${path}?${query({ ...base, region })}`, options) : null,
    optional(getJson(`${inventoryPath}?${query(period)}`, options)),
    optional(!token && region ? getJson(`${inventoryPath}?${query({ ...period, region })}`, options) : null),
  ])
  return { snapshot: combineSnapshot(all, declared, region, municipality), inventory: inventoryFor(token, region, inventory, inventoryDeclared) }
}

/** What counts as "new records": operational content, not timestamps or the rolling period end. */
const contentKey = data => fingerprint({ s: data?.snapshot?.summary, m: data?.snapshot?.municipalities, t: data?.snapshot?.territorial?.municipalities, f: data?.snapshot?.map?.features, c: data?.snapshot?.categories, k: data?.snapshot?.caseStates, i: data?.inventory?.rows })

/**
 * Three kinds of load share one effect:
 *  - filters: the question changed → dim, replace, and on failure show the error without stale data;
 *  - manual: "Actualizar consulta" → dim, keep current data if it fails;
 *  - background: periodic tick → invisible; replace data only when the content changed.
 */
export function useObservatoryData({ api, token, filters, revision, refreshKey, tick, track }) {
  const [state, setState] = useState({ data: null, error: '', busy: true, stale: '', checkedAt: null, notice: 0 })
  const memory = useRef({ key: null, revision, refreshKey, full: null, content: null })
  const queryKey = fingerprint({ api, token: token || '', filters })
  useEffect(() => {
    const controller = new AbortController(), m = memory.current
    const mode = m.key !== queryKey ? 'filters' : (m.revision !== revision || m.refreshKey !== refreshKey) ? 'manual' : 'background'
    m.revision = revision; m.refreshKey = refreshKey
    if (mode !== 'background') setState(s => ({ ...s, busy: true, error: mode === 'filters' ? '' : s.error }))
    track(loadObservatory({ api, token, filters, signal: controller.signal })).then(data => {
      const full = fingerprint(data), content = contentKey(data)
      const changed = full !== m.full || m.key !== queryKey
      const fresh = mode === 'background' && m.content !== null && content !== m.content
      m.key = queryKey; m.full = full; m.content = content
      setState(s => ({ data: changed ? data : s.data, busy: false, error: '', stale: '', checkedAt: Date.now(), notice: fresh ? s.notice + 1 : s.notice }))
    }).catch(e => {
      if (e.name === 'AbortError') return
      if (mode === 'filters') { m.key = queryKey; m.full = null; m.content = null; setState(s => ({ ...s, data: null, busy: false, error: e.message, stale: '' })) }
      else setState(s => ({ ...s, busy: false, stale: e.message }))
    })
    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, revision, refreshKey, tick])
  return state
}
