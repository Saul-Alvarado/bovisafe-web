import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileSpreadsheet, Lock, MapPinned, RotateCcw, Warehouse, ArrowDownUp, Info, X } from 'lucide-react'
import { getApiBase } from '../apiConfig.js'
import { getJson, fingerprint } from '../live/live.js'
import { toCsv, downloadCsv, safeFileName, SEPARATORS } from '../reports/csv.js'
import { MUNICIPAL_METRICS, RANCH_METRICS, municipalColumns, ranchColumns, regionNames, mexicoDate, num, ACCESS, sumRows, officialRegionName } from '../reports/definitions.js'
import { combineRegionRows, regionIncludes, ranchInRegion, MEMBERSHIP_LABEL, REGION_SOURCE, UNASSIGNED_NOTE } from '../territory/regions.js'

const fmt = value => num(value).toLocaleString('es-MX')
// An empty 'to' always means "today" for the server (America/Mexico_City), so new records keep entering.
const reportDefaults = start => ({ from: start, to: '', month: '', region: '', municipality: '' })
const MUNICIPAL_KEYS = [...new Set([...MUNICIPAL_METRICS.map(m => m.key), 'evaluated_ranches', 'nws_predictions', 'follow_up_cases'])]
const RANCH_KEYS = RANCH_METRICS.map(m => m.key)
const query = params => new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()

function useVisible(ref) {
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    if (visible || !ref.current) return
    const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) setVisible(true) }, { rootMargin: '600px 0px' })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [visible, ref])
  return visible
}

/**
 * Loads one report. A new question shows the loading state; periodic ticks refresh silently, keep the
 * table if they fail and replace the data only when its content changed. Sorting, filters and an export
 * in progress live outside this state, so a refresh never resets them.
 */
function useReport(url, token, enabled, tick, track) {
  const [state, setState] = useState({ data: null, error: '', busy: false })
  const [revision, setRevision] = useState(0)
  const memory = useRef({ url: null, revision: 0, key: null })
  useEffect(() => {
    if (!enabled || !url) return
    const controller = new AbortController(), m = memory.current
    const background = m.url === url && m.revision === revision && m.key !== null
    m.revision = revision
    if (!background) setState(s => ({ ...s, busy: true, error: '' }))
    const request = getJson(url, { token, signal: controller.signal, fallback: 'No se pudo consultar el reporte' })
    ;(track ? track(request) : request).then(data => {
      const key = fingerprint(data), changed = key !== m.key || m.url !== url
      m.url = url; m.key = key
      setState(s => (changed || s.busy || s.error ? { data: changed ? data : s.data, error: '', busy: false } : s))
    }).catch(e => {
      if (e.name === 'AbortError') return
      if (background) { setState(s => (s.busy ? { ...s, busy: false } : s)); return }
      m.url = url; m.key = null
      setState({ data: null, error: e.message, busy: false })
    })
    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, token, enabled, revision, tick])
  return { ...state, retry: () => setRevision(v => v + 1) }
}

function SortHeader({ column, sort, setSort, numeric }) {
  const active = sort.key === column.key
  return <th scope="col" className={numeric ? 'num' : ''} aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
    <button type="button" onClick={() => setSort(s => ({ key: column.key, dir: s.key === column.key ? -s.dir : numeric ? -1 : 1 }))} title={column.label}>
      <span>{column.short || column.label}</span><ArrowDownUp aria-hidden="true" size={12} className={active ? 'on' : ''} />
    </button>
  </th>
}

function sortRows(rows, sort, text) {
  if (!sort.key) return rows
  return rows.slice().sort((a, b) => {
    const x = a[sort.key], y = b[sort.key]
    const value = typeof x === 'number' || typeof y === 'number' ? num(x) - num(y) : text(a).localeCompare(text(b), 'es')
    return value * sort.dir
  })
}

export default function Reports({ token, geography, months, start, end, onLogin, observatoryFilters, tick = 0, track }) {
  const ref = useRef(null)
  const visible = useVisible(ref)
  const api = getApiBase()
  const [tab, setTab] = useState('municipal')
  const [filters, setFilters] = useState(() => reportDefaults(start))
  const [separator, setSeparator] = useState('comma')
  const [onlyActive, setOnlyActive] = useState(false)
  const [sort, setSort] = useState({ key: '', dir: 1 })
  const regions = geography?.regions || []
  const municipalityOptions = useMemo(() => geography?.municipalities.features.map(f => f.properties).sort((a, b) => a.name.localeCompare(b.name, 'es')) || [], [geography])
  const regionOptions = filters.region ? municipalityOptions.filter(m => regionIncludes(filters.region, m.code)) : municipalityOptions
  const regionName = filters.region ? regionNames([filters.region], regions) : ''
  const municipalityName = filters.municipality ? municipalityOptions.find(m => m.code === filters.municipality)?.name || filters.municipality : ''

  // Region and municipality are applied here, so changing them updates table and CSV at once. The
  // server is asked for the period, plus the declared-region slice while a region is active.
  const period = { from: filters.from, to: filters.to, month: filters.month }
  const municipalOn = visible && tab === 'municipal', ranchOn = visible && tab === 'ranch' && !!token
  const all = useReport(`${api}/reports/municipalities?${query(period)}`, null, municipalOn, tick, track)
  const declared = useReport(filters.region ? `${api}/reports/municipalities?${query({ ...period, region: filters.region })}` : null, null, municipalOn && !!filters.region, tick, track)
  const ranch = useReport(`${api}/reports/ranches?${query(period)}`, token, ranchOn, tick, track)
  const regionReady = !filters.region || !!declared.data
  const municipalReport = { data: all.data && regionReady ? all.data : null, busy: all.busy || (!!filters.region && declared.busy), error: all.error || (filters.region ? declared.error : ''), retry: () => { all.retry(); if (filters.region) declared.retry() } }
  const report = tab === 'municipal' ? municipalReport : ranch
  useEffect(() => setSort({ key: '', dir: 1 }), [tab])

  const update = (key, value) => setFilters(f => ({ ...f, [key]: value, ...(['from', 'to'].includes(key) ? { month: '' } : {}), ...(key === 'region' ? { municipality: '' } : {}) }))
  const fromObservatory = () => setFilters({ from: observatoryFilters.from, to: observatoryFilters.to, month: observatoryFilters.month, region: observatoryFilters.region, municipality: observatoryFilters.municipality })

  const metrics = tab === 'municipal' ? MUNICIPAL_METRICS : RANCH_METRICS
  const data = report.data
  const scoped = useMemo(() => {
    if (!data) return []
    if (tab === 'ranch') return data.rows.filter(r => ranchInRegion(filters.region, r.municipality_code, r.region) && (!filters.municipality || r.municipality_code === filters.municipality))
    let list
    if (filters.region) {
      const unlocated = declared.data?.unlocated
      list = [...combineRegionRows(data.rows, declared.data?.rows, filters.region), ...(unlocated && (num(unlocated.registered_ranches) || num(unlocated.evaluations)) ? [{ ...unlocated, membership: 'declared' }] : [])]
    } else list = [...data.rows, ...(data.unlocated ? [data.unlocated] : [])]
    return filters.municipality ? list.filter(r => r.code === filters.municipality) : list
  }, [data, declared.data, tab, filters.region, filters.municipality])
  // Totals are always the sum of exactly the rows in scope, so table, footer and CSV agree.
  const totals = useMemo(() => sumRows(scoped, tab === 'municipal' ? MUNICIPAL_KEYS : RANCH_KEYS), [scoped, tab])
  const rows = useMemo(() => {
    const list = tab === 'municipal' && onlyActive ? scoped.filter(r => num(r.registered_ranches) > 0 || num(r.evaluations) > 0) : scoped
    return sortRows(list, sort, r => String(tab === 'municipal' ? r.name : r.ranch_name))
  }, [scoped, tab, onlyActive, sort])

  const place = filters.municipality ? municipalityName : filters.region ? regionName : ''
  const totalLabel = tab === 'municipal' ? `Total ${place || 'Guerrero'}` : `Total de ranchos autorizados${place ? ` · ${place}` : ''}`
  const scopeLabel = filters.municipality ? `Municipio ${municipalityName}` : filters.region ? `Región ${regionName}` : tab === 'municipal' ? 'Todo Guerrero · 85 municipios' : 'Todos los ranchos autorizados'
  const activeFilters = [
    filters.month && ['month', `Mes ${filters.month}`],
    !filters.month && filters.from && filters.from !== start && ['from', `Desde ${filters.from}`],
    !filters.month && filters.to && ['to', `Hasta ${filters.to}`],
    filters.region && ['region', `Región ${regionName}`],
    filters.municipality && ['municipality', municipalityName],
  ].filter(Boolean)

  function exportCsv() {
    const columns = tab === 'municipal' ? municipalColumns(regions, !!filters.region) : ranchColumns(regions)
    const totalRow = columns.map((c, i) => {
      if (tab === 'municipal') return i === 0 ? 'TOTAL' : i === 1 ? totalLabel : metrics.some(m => m.key === c.key) ? num(totals[c.key]) : ''
      return i === 0 ? totalLabel : metrics.some(m => m.key === c.key) ? num(totals[c.key]) : ''
    })
    const notes = [
      ['Reporte', tab === 'municipal' ? 'Reporte municipal de vigilancia bovina (público, agregado)' : 'Reporte privado por rancho (solo ranchos autorizados)'],
      ['Periodo', `${data.from} a ${data.to}`],
      ['Ámbito', filters.municipality ? `Municipio: ${municipalityName}` : filters.region ? `Región: ${regionName}` : 'Todo Guerrero'],
      ['Filtros activos', activeFilters.map(([, label]) => label).join(' · ') || 'Ninguno'],
      ['Filas', String(rows.length)],
      ['Generado', mexicoDate(data.generatedAt) + ' (hora del centro de México)'],
      ['Criterios', data.criteria || 'Registros operativos; registros de prueba excluidos.'],
      ['Aviso', 'Una predicción de IA compatible con miasis no constituye un diagnóstico confirmado. Bovinos evaluados cuenta animales únicos; evaluaciones cuenta fotografías analizadas.'],
    ]
    if (filters.region) notes.push(['Regionalización', `${REGION_SOURCE} Un municipio cuenta completo si pertenece a la región; fuera de ella solo cuentan los ranchos que declararon la región. Sierra se delimita por localidades. ${UNASSIGNED_NOTE}`])
    if (tab === 'municipal' && onlyActive) notes.push(['Filtro de tabla', 'Solo municipios con registros'])
    const csv = toCsv(columns, rows, { separator: SEPARATORS[separator], footer: [totalRow], notes })
    downloadCsv(csv, safeFileName('bovisafe', tab === 'municipal' ? 'reporte-municipal' : 'reporte-ranchos', data.from, data.to, filters.region, filters.municipality && municipalityName))
  }

  const locked = tab === 'ranch' && !token
  const emptyRanches = tab === 'ranch' && data && scoped.length === 0
  return <section id="reportes" ref={ref} className="obs-section reports" aria-labelledby="reports-title">
    <div className="obs-section-heading">
      <div><span>REPORTES Y EXPORTACIÓN</span><h2 id="reports-title">Reportes y exportación</h2><p className="section-lead">Tablas consolidadas con los mismos criterios del observatorio. Descarga CSV compatible con Excel en español.</p></div>
    </div>
    <div className="reports-card">
      <div className="reports-tabs" role="tablist" aria-label="Tipo de reporte">
        <button role="tab" id="tab-municipal" aria-selected={tab === 'municipal'} aria-controls="report-panel" onClick={() => setTab('municipal')}><MapPinned size={17} aria-hidden="true" /><span>Reporte municipal<small>Público · 85 municipios</small></span></button>
        <button role="tab" id="tab-ranch" aria-selected={tab === 'ranch'} aria-controls="report-panel" onClick={() => setTab('ranch')}>{token ? <Warehouse size={17} aria-hidden="true" /> : <Lock size={17} aria-hidden="true" />}<span>Reporte por rancho<small>{token ? 'Privado · ranchos autorizados' : 'Requiere iniciar sesión'}</small></span></button>
      </div>
      <div className="reports-filters" aria-label="Filtros del reporte">
        <div className="rep-field"><label htmlFor="rep-from">Desde (reporte)</label><input id="rep-from" type="date" min={start} max={end} value={filters.from} onChange={e => update('from', e.target.value)} /></div>
        <div className="rep-field"><label htmlFor="rep-to">Hasta (reporte)</label><input id="rep-to" type="date" min={start} max={end} value={filters.to || end} onChange={e => update('to', e.target.value === end ? '' : e.target.value)} /></div>
        <div className="rep-field"><label htmlFor="rep-month">Mes (reporte)</label><select id="rep-month" value={filters.month} onChange={e => update('month', e.target.value)}><option value="">Todo el periodo</option>{months.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
        <div className="rep-field"><label htmlFor="rep-region">Región (reporte)</label><select id="rep-region" value={filters.region} onChange={e => update('region', e.target.value)}><option value="">Todas las regiones</option>{regions.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}</select></div>
        <div className="rep-field"><label htmlFor="rep-municipality">Municipio (reporte)</label><select id="rep-municipality" value={filters.municipality} onChange={e => update('municipality', e.target.value)}><option value="">{filters.region ? `Todos los de ${regionName}` : 'Todos los municipios'}</option>{regionOptions.map(m => <option key={m.code} value={m.code}>{m.name}</option>)}</select></div>
        <div className="reports-filter-actions">
          {observatoryFilters && <button type="button" className="ghost" onClick={fromObservatory}>Usar filtros del observatorio</button>}
          <button type="button" className="ghost" onClick={() => setFilters(reportDefaults(start))}><RotateCcw size={14} aria-hidden="true" />Restablecer</button>
        </div>
      </div>
      <div className="reports-active" aria-label="Filtros activos del reporte">
        <span className="reports-active-label">Ámbito: <strong data-scope>{scopeLabel}</strong></span>
        {activeFilters.map(([key, label]) => <button key={key} type="button" className="obs-chip" onClick={() => update(key, '')} aria-label={`Quitar filtro ${label}`}>{label}<X size={12} aria-hidden="true" /></button>)}
      </div>

      <div id="report-panel" role="tabpanel" aria-labelledby={tab === 'municipal' ? 'tab-municipal' : 'tab-ranch'} className="reports-body" aria-busy={report.busy}>
        {locked ? <div className="reports-locked"><Lock size={28} aria-hidden="true" /><div><strong>Reporte privado por rancho</strong><p>Disponible solo para propietarios y veterinarios asignados. Los permisos se verifican en el servidor; el reporte público nunca muestra nombres de ranchos, propietarios ni coordenadas.</p>{onLogin && <button type="button" className="primary" onClick={onLogin}>Iniciar sesión para consultar</button>}</div></div> : <>
          <div className="reports-toolbar">
            <div className="reports-summary" aria-live="polite">
              {report.busy && !data ? <span className="reports-chip loading">Cargando reporte…</span> : data ? <><span className="reports-chip" data-rows={rows.length}><FileSpreadsheet size={14} aria-hidden="true" />{rows.length} {tab === 'municipal' ? (rows.length === 1 ? 'fila' : 'filas') : rows.length === 1 ? 'rancho' : 'ranchos'}</span><span className="reports-chip subtle">{data.from} a {data.to}</span>{report.busy && <span className="reports-chip loading">Actualizando…</span>}</> : null}
            </div>
            <div className="reports-actions">
              {tab === 'municipal' && <label className="toggle"><input type="checkbox" checked={onlyActive} onChange={e => setOnlyActive(e.target.checked)} /><span>Solo municipios con registros</span></label>}
              <label className="separator" htmlFor="rep-separator">Separador</label><select id="rep-separator" className="separator-select" value={separator} onChange={e => setSeparator(e.target.value)} aria-label="Separador del archivo CSV"><option value="comma">Coma (Excel México)</option><option value="semicolon">Punto y coma (Excel España)</option></select>
              <button type="button" className="primary" disabled={!data || report.busy || !rows.length} onClick={exportCsv}><Download size={16} aria-hidden="true" />Descargar CSV</button>
            </div>
          </div>
          {report.error && <div className="reports-error" role="status"><strong>{report.error}</strong><span>No se muestran datos sustitutos.</span><button type="button" onClick={report.retry}>Reintentar</button></div>}
          {!report.error && report.busy && !data && <div className="reports-skeleton" role="status" aria-label="Cargando reporte">{Array.from({ length: 6 }, (_, i) => <i key={i} />)}</div>}
          {data && !report.error && (emptyRanches ? <div className="reports-empty" role="status"><Warehouse size={26} aria-hidden="true" /><div><strong>No hay ranchos autorizados con estos filtros.</strong><span>Los ranchos registrados desde Android aparecerán aquí, incluso si todavía no tienen evaluaciones.</span></div></div> :
            <div className={'reports-table-wrap' + (report.busy ? ' is-busy' : '')} tabIndex={0} role="region" aria-label={tab === 'municipal' ? 'Tabla del reporte municipal' : 'Tabla del reporte por rancho'}>
              <table className="reports-table">
                <thead><tr>
                  {tab === 'municipal' ? <><SortHeader column={{ key: 'name', label: 'Municipio' }} sort={sort} setSort={setSort} /><th scope="col">Región</th></> : <><SortHeader column={{ key: 'ranch_name', label: 'Rancho' }} sort={sort} setSort={setSort} /><th scope="col">Municipio</th></>}
                  {metrics.map(m => <SortHeader key={m.key} column={m} sort={sort} setSort={setSort} numeric />)}
                  {tab === 'ranch' && <SortHeader column={{ key: 'last_evaluation_at', label: 'Última evaluación' }} sort={sort} setSort={setSort} />}
                </tr></thead>
                <tbody>{rows.map(row => tab === 'municipal'
                  ? <tr key={row.code} data-code={row.code} className={num(row.evaluations) || num(row.registered_ranches) ? '' : 'is-zero'}><th scope="row">{row.name}{row.code === 'UNLOCATED' && <small>Ranchos sin municipio verificado</small>}{row.membership && row.membership !== 'official' && <small>{MEMBERSHIP_LABEL[row.membership]}</small>}</th><td className="muted nowrap">{officialRegionName(row.code, regions) || '—'}{row.regions?.length ? <small>Declarada: {regionNames(row.regions, regions)}</small> : null}</td>{metrics.map(m => <td key={m.key} className={`num g-${m.group}${num(row[m.key]) ? '' : ' zero'}`}>{fmt(row[m.key])}</td>)}</tr>
                  : <tr key={row.ranch_id} className={num(row.evaluations) ? '' : 'is-zero'}><th scope="row">{row.ranch_name}<small>{ACCESS[row.access]}{row.region ? ` · ${regionNames([row.region], regions)}` : ''}</small></th><td className="muted">{row.municipality_name}</td>{metrics.map(m => <td key={m.key} className={`num g-${m.group}${num(row[m.key]) ? '' : ' zero'}`}>{fmt(row[m.key])}</td>)}<td className="muted nowrap">{row.last_evaluation_at ? mexicoDate(row.last_evaluation_at) : <span className="no-eval">Sin evaluaciones</span>}</td></tr>)}
                </tbody>
                <tfoot><tr><th scope="row" data-total-label>{totalLabel}</th><td className="muted">{tab === 'municipal' ? `${fmt(totals.registered_ranches)} ranchos` : ''}</td>{metrics.map(m => <td key={m.key} className="num" data-total={m.key}>{fmt(totals[m.key])}</td>)}{tab === 'ranch' && <td />}</tr></tfoot>
              </table>
            </div>)}
          <p className="reports-note"><Info size={14} aria-hidden="true" /><span><strong>Bovinos evaluados</strong> cuenta animales únicos; <strong>evaluaciones</strong> cuenta fotografías analizadas. Una predicción de IA compatible con miasis no constituye un diagnóstico confirmado. Ranchos y bovinos registrados corresponden a registros activos; los registros de prueba están excluidos.{filters.region ? ` Regiones: ${REGION_SOURCE} Sierra se delimita por localidades; fuera de General Heliodoro Castillo y Leonardo Bravo solo cuentan los ranchos que declararon esa región.` : ''}</span></p>
        </>}
      </div>
    </div>
  </section>
}
