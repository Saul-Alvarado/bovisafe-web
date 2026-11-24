import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileSpreadsheet, Lock, MapPinned, RotateCcw, Warehouse, ArrowDownUp, Info } from 'lucide-react'
import { getApiBase } from '../apiConfig.js'
import { toCsv, downloadCsv, safeFileName, SEPARATORS } from '../reports/csv.js'
import { MUNICIPAL_METRICS, RANCH_METRICS, municipalColumns, ranchColumns, regionNames, mexicoDate, num, ACCESS } from '../reports/definitions.js'

const fmt = value => num(value).toLocaleString('es-MX')
const reportDefaults = (start, end) => ({ from: start, to: end, month: '', region: '', municipality: '' })

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

function useReport(path, filters, token, enabled) {
  const [state, setState] = useState({ data: null, error: '', busy: false })
  const [revision, setRevision] = useState(0)
  const api = getApiBase()
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    setState(s => ({ ...s, busy: true, error: '' }))
    const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v))
    fetch(`${api}${path}?${query}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal })
      .then(async r => {
        if (!r.ok) {
          let message; try { message = (await r.json()).message } catch { /* not JSON */ }
          if (r.status === 404 && !message) message = 'El servicio de reportes no está disponible en este servidor.'
          if (r.status === 401) message = 'Tu sesión terminó. Inicia sesión nuevamente para consultar el reporte privado.'
          throw new Error(message || `No se pudo consultar el reporte (${r.status})`)
        }
        return r.json()
      })
      .then(data => setState({ data, error: '', busy: false }))
      .catch(e => { if (e.name !== 'AbortError') setState({ data: null, error: e.message, busy: false }) })
    return () => controller.abort()
  }, [api, path, token, enabled, revision, filters])
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

export default function Reports({ token, geography, months, start, end, onLogin, observatoryFilters }) {
  const ref = useRef(null)
  const visible = useVisible(ref)
  const [tab, setTab] = useState('municipal')
  const [filters, setFilters] = useState(() => reportDefaults(start, end))
  const [separator, setSeparator] = useState('comma')
  const [onlyActive, setOnlyActive] = useState(false)
  const [sort, setSort] = useState({ key: '', dir: 1 })
  const regions = geography?.regions || []
  const municipalityOptions = useMemo(() => geography?.municipalities.features.map(f => f.properties).sort((a, b) => a.name.localeCompare(b.name, 'es')) || [], [geography])
  const municipal = useReport('/reports/municipalities', filters, null, visible && tab === 'municipal')
  const ranch = useReport('/reports/ranches', filters, token, visible && tab === 'ranch' && !!token)
  const report = tab === 'municipal' ? municipal : ranch
  useEffect(() => setSort({ key: '', dir: 1 }), [tab])

  const update = (key, value) => setFilters(f => ({ ...f, [key]: value, ...(['from', 'to'].includes(key) ? { month: '' } : {}), ...(key === 'region' ? { municipality: '' } : {}) }))
  const fromObservatory = () => setFilters({ from: observatoryFilters.from, to: observatoryFilters.to, month: observatoryFilters.month, region: observatoryFilters.region, municipality: observatoryFilters.municipality })

  const metrics = tab === 'municipal' ? MUNICIPAL_METRICS : RANCH_METRICS
  const data = report.data
  const rows = useMemo(() => {
    if (!data) return []
    let list = tab === 'municipal' ? [...data.rows, ...(data.unlocated ? [data.unlocated] : [])] : data.rows
    if (tab === 'municipal' && onlyActive) list = list.filter(r => num(r.registered_ranches) > 0 || num(r.evaluations) > 0)
    return sortRows(list, sort, r => String(tab === 'municipal' ? r.name : r.ranch_name))
  }, [data, tab, onlyActive, sort])
  const totals = data?.totals

  function exportCsv() {
    const columns = tab === 'municipal' ? municipalColumns(regions) : ranchColumns(regions)
    const label = tab === 'municipal' ? 'Total Guerrero' : 'Total de ranchos autorizados'
    const totalRow = columns.map((c, i) => {
      if (tab === 'municipal') return i === 0 ? 'TOTAL' : i === 1 ? label : metrics.some(m => m.key === c.key) ? num(totals?.[c.key]) : ''
      return i === 0 ? label : metrics.some(m => m.key === c.key) ? num(totals?.[c.key]) : ''
    })
    const scope = [filters.region && `Región: ${regionNames([filters.region], regions)}`, filters.municipality && `Municipio: ${municipalityOptions.find(m => m.code === filters.municipality)?.name}`].filter(Boolean).join(' · ') || 'Todo Guerrero'
    const notes = [
      ['Reporte', tab === 'municipal' ? 'Reporte municipal de vigilancia bovina (público, agregado)' : 'Reporte privado por rancho (solo ranchos autorizados)'],
      ['Periodo', `${data.from} a ${data.to}`],
      ['Ámbito', scope],
      ['Generado', mexicoDate(data.generatedAt) + ' (hora del centro de México)'],
      ['Criterios', data.criteria || 'Registros operativos; registros de prueba excluidos.'],
      ['Aviso', 'Una predicción de IA compatible con miasis no constituye un diagnóstico confirmado. Bovinos evaluados cuenta animales únicos; evaluaciones cuenta fotografías analizadas.'],
    ]
    if (tab === 'municipal' && onlyActive) notes.push(['Filtro de tabla', 'Solo municipios con registros'])
    const csv = toCsv(columns, rows, { separator: SEPARATORS[separator], footer: [totalRow], notes })
    downloadCsv(csv, safeFileName('bovisafe', tab === 'municipal' ? 'reporte-municipal' : 'reporte-ranchos', data.from, data.to, filters.region, filters.municipality))
  }

  const locked = tab === 'ranch' && !token
  const emptyRanches = tab === 'ranch' && data && data.rows.length === 0
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
        <div className="rep-field"><label htmlFor="rep-to">Hasta (reporte)</label><input id="rep-to" type="date" min={start} max={end} value={filters.to} onChange={e => update('to', e.target.value)} /></div>
        <div className="rep-field"><label htmlFor="rep-month">Mes (reporte)</label><select id="rep-month" value={filters.month} onChange={e => update('month', e.target.value)}><option value="">Todo el periodo</option>{months.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
        <div className="rep-field"><label htmlFor="rep-region">Región (reporte)</label><select id="rep-region" value={filters.region} onChange={e => update('region', e.target.value)}><option value="">Todas las regiones</option>{regions.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}</select></div>
        <div className="rep-field"><label htmlFor="rep-municipality">Municipio (reporte)</label><select id="rep-municipality" value={filters.municipality} onChange={e => update('municipality', e.target.value)}><option value="">Todos los municipios</option>{municipalityOptions.map(m => <option key={m.code} value={m.code}>{m.name}</option>)}</select></div>
        <div className="reports-filter-actions">
          {observatoryFilters && <button type="button" className="ghost" onClick={fromObservatory}>Usar filtros del observatorio</button>}
          <button type="button" className="ghost" onClick={() => setFilters(reportDefaults(start, end))}><RotateCcw size={14} aria-hidden="true" />Restablecer</button>
        </div>
      </div>

      <div id="report-panel" role="tabpanel" aria-labelledby={tab === 'municipal' ? 'tab-municipal' : 'tab-ranch'} className="reports-body" aria-busy={report.busy}>
        {locked ? <div className="reports-locked"><Lock size={28} aria-hidden="true" /><div><strong>Reporte privado por rancho</strong><p>Disponible solo para propietarios y veterinarios asignados. Los permisos se verifican en el servidor; el reporte público nunca muestra nombres de ranchos, propietarios ni coordenadas.</p>{onLogin && <button type="button" className="primary" onClick={onLogin}>Iniciar sesión para consultar</button>}</div></div> : <>
          <div className="reports-toolbar">
            <div className="reports-summary" aria-live="polite">
              {report.busy && !data ? <span className="reports-chip loading">Cargando reporte…</span> : data ? <><span className="reports-chip"><FileSpreadsheet size={14} aria-hidden="true" />{rows.length} {tab === 'municipal' ? 'filas' : rows.length === 1 ? 'rancho' : 'ranchos'}</span><span className="reports-chip subtle">{data.from} a {data.to}</span>{report.busy && <span className="reports-chip loading">Actualizando…</span>}</> : null}
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
                  {tab === 'municipal' ? <><SortHeader column={{ key: 'name', label: 'Municipio' }} sort={sort} setSort={setSort} /><th scope="col">Región declarada</th></> : <><SortHeader column={{ key: 'ranch_name', label: 'Rancho' }} sort={sort} setSort={setSort} /><th scope="col">Municipio</th></>}
                  {metrics.map(m => <SortHeader key={m.key} column={m} sort={sort} setSort={setSort} numeric />)}
                  {tab === 'ranch' && <SortHeader column={{ key: 'last_evaluation_at', label: 'Última evaluación' }} sort={sort} setSort={setSort} />}
                </tr></thead>
                <tbody>{rows.map(row => tab === 'municipal'
                  ? <tr key={row.code} className={num(row.evaluations) || num(row.registered_ranches) ? '' : 'is-zero'}><th scope="row">{row.name}{row.code === 'UNLOCATED' && <small>Ranchos sin municipio verificado</small>}</th><td className="muted">{regionNames(row.regions, regions) || '—'}</td>{metrics.map(m => <td key={m.key} className={`num g-${m.group}${num(row[m.key]) ? '' : ' zero'}`}>{fmt(row[m.key])}</td>)}</tr>
                  : <tr key={row.ranch_id} className={num(row.evaluations) ? '' : 'is-zero'}><th scope="row">{row.ranch_name}<small>{ACCESS[row.access]}{row.region ? ` · ${regionNames([row.region], regions)}` : ''}</small></th><td className="muted">{row.municipality_name}</td>{metrics.map(m => <td key={m.key} className={`num g-${m.group}${num(row[m.key]) ? '' : ' zero'}`}>{fmt(row[m.key])}</td>)}<td className="muted nowrap">{row.last_evaluation_at ? mexicoDate(row.last_evaluation_at) : <span className="no-eval">Sin evaluaciones</span>}</td></tr>)}
                </tbody>
                <tfoot><tr><th scope="row">{tab === 'municipal' ? 'Total Guerrero' : 'Total autorizado'}</th><td className="muted">{tab === 'municipal' ? `${fmt(totals?.registered_ranches)} ranchos` : ''}</td>{metrics.map(m => <td key={m.key} className="num" data-total={m.key}>{fmt(totals?.[m.key])}</td>)}{tab === 'ranch' && <td />}</tr></tfoot>
              </table>
            </div>)}
          <p className="reports-note"><Info size={14} aria-hidden="true" /><span><strong>Bovinos evaluados</strong> cuenta animales únicos; <strong>evaluaciones</strong> cuenta fotografías analizadas. Una predicción de IA compatible con miasis no constituye un diagnóstico confirmado. Ranchos y bovinos registrados corresponden a registros activos; los registros de prueba están excluidos.</span></p>
        </>}
      </div>
    </div>
  </section>
}
