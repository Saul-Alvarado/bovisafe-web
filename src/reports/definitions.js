// Column definitions shared by the on-screen tables and the CSV export.
// "Bovinos evaluados" counts unique animals; "Evaluaciones" counts photographs analysed.
// An AI prediction compatible with myiasis is never a confirmed diagnosis.
import { officialRegion, MEMBERSHIP_LABEL } from '../territory/regions.js'

export const num = value => Math.max(0, Number(value) || 0)

export function mexicoDate(iso, withTime = true) {
  if (!iso) return ''
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z')
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const get = type => parts.find(p => p.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}` + (withTime ? ` ${get('hour')}:${get('minute')}` : '')
}

export const regionNames = (codes, regions) => (codes || []).map(code => regions?.find(r => r.code === code)?.name || code).join(', ')

export const MUNICIPAL_METRICS = [
  { key: 'registered_ranches', label: 'Ranchos registrados', short: 'Ranchos', group: 'registry' },
  { key: 'registered_animals', label: 'Bovinos registrados', short: 'Bovinos', group: 'registry' },
  { key: 'animals', label: 'Bovinos evaluados (únicos)', short: 'Evaluados', group: 'activity' },
  { key: 'evaluations', label: 'Evaluaciones sanitarias válidas', short: 'Evaluaciones', group: 'activity' },
  { key: 'nws_animals', label: 'Bovinos con resultado compatible con miasis (predicción IA)', short: 'Compatibles IA', group: 'visual' },
  { key: 'suspected_animals', label: 'Bovinos con sospecha profesional', short: 'Sospecha prof.', group: 'suspected' },
  { key: 'confirmed_animals', label: 'Bovinos con diagnóstico veterinario confirmado', short: 'Confirmados', group: 'confirmed' },
  { key: 'follow_up_animals', label: 'Bovinos en seguimiento', short: 'Seguimiento', group: 'follow' },
  { key: 'suspected_cases', label: 'Casos sospechosos', short: 'Casos sosp.', group: 'suspected' },
  { key: 'confirmed_cases', label: 'Casos confirmados', short: 'Casos conf.', group: 'confirmed' },
  { key: 'closed_cases', label: 'Casos cerrados', short: 'Cerrados', group: 'closed' },
]

export const RANCH_METRICS = [
  { key: 'registered_animals', label: 'Bovinos registrados', short: 'Bovinos', group: 'registry' },
  { key: 'animals', label: 'Bovinos evaluados (únicos)', short: 'Evaluados', group: 'activity' },
  { key: 'evaluations', label: 'Total de evaluaciones', short: 'Evaluaciones', group: 'activity' },
  { key: 'nws_animals', label: 'Bovinos con resultado compatible con miasis (predicción IA)', short: 'Compatibles IA', group: 'visual' },
  { key: 'suspected_animals', label: 'Bovinos con sospecha profesional', short: 'Sospecha prof.', group: 'suspected' },
  { key: 'confirmed_animals', label: 'Bovinos con diagnóstico veterinario confirmado', short: 'Confirmados', group: 'confirmed' },
  { key: 'follow_up_animals', label: 'Bovinos en seguimiento', short: 'Seguimiento', group: 'follow' },
]

/** Region the whole municipality belongs to in the official catalog (empty when none is published). */
export const officialRegionName = (code, regions) => { const region = officialRegion(code); return region ? regionNames([region], regions) : '' }

export function municipalColumns(regions, withMembership = false) {
  return [
    { key: 'code', label: 'Clave INEGI' },
    { key: 'name', label: 'Municipio' },
    { key: 'official_region', label: 'Región (catálogo oficial)', value: row => officialRegionName(row.code, regions) },
    { key: 'regions', label: 'Región declarada por ranchos', value: row => regionNames(row.regions, regions) },
    ...(withMembership ? [{ key: 'membership', label: 'Pertenencia a la región filtrada', value: row => MEMBERSHIP_LABEL[row.membership] || '' }] : []),
    ...MUNICIPAL_METRICS.map(m => ({ key: m.key, label: m.label, value: row => num(row[m.key]) })),
  ]
}

export const ACCESS = { OWNER: 'Propietario', VETERINARIAN: 'Veterinario asignado' }

export function ranchColumns(regions) {
  return [
    { key: 'ranch_name', label: 'Rancho' },
    { key: 'municipality_name', label: 'Municipio' },
    { key: 'region', label: 'Región declarada', value: row => regionNames(row.region ? [row.region] : [], regions) },
    { key: 'access', label: 'Acceso', value: row => ACCESS[row.access] || '' },
    ...RANCH_METRICS.map(m => ({ key: m.key, label: m.label, value: row => num(row[m.key]) })),
    { key: 'last_evaluation_at', label: 'Fecha de última evaluación (hora del centro de México)', value: row => mexicoDate(row.last_evaluation_at) || 'Sin evaluaciones en el periodo' },
  ]
}

export function sumRows(rows, keys) {
  const out = {}
  for (const key of keys) out[key] = rows.reduce((total, row) => total + num(row[key]), 0)
  return out
}
