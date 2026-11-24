import {resultLabel,SANITARY_CODES} from '../resultLabels.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, Beef, Warehouse, ScanSearch, Stethoscope, ShieldCheck, ClipboardList, CheckCircle2, RotateCcw, RefreshCw, LogIn, SlidersHorizontal, Lock, Globe2 } from 'lucide-react'
import { getApiBase } from '../apiConfig.js'
import OperationalMap from './OperationalMap.jsx'
import Reports from './Reports.jsx'
import '../styles/observatory.css'
const START='2026-11-01'
function today(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-')}
function months(){const out=[];for(let y=2026,m=11;`${y}-${String(m).padStart(2,'0')}`<=today().slice(0,7);){out.push(`${y}-${String(m).padStart(2,'0')}`);if(++m>12){m=1;y++}}return out}
const defaults=()=>({from:START,to:today(),month:'',region:'',municipality:'',category:'',followUp:''})
const clinical={PENDING_REVIEW:'Pendiente de valoración',SUSPECTED:'Sospecha profesional',CONFIRMED:'Confirmado por profesional',DISCARDED:'Descartado por profesional',UNDETERMINED:'Valoración no concluyente',FOLLOW_UP:'En seguimiento',CLOSED:'Cerrado',NO_CASE:'Sin caso abierto'}
const monthName=value=>{const [y,m]=value.split('-').map(Number);return new Date(Date.UTC(y,m-1,15)).toLocaleDateString('es-MX',{month:'short',year:'numeric',timeZone:'UTC'})}
const METRICS=[
 {key:'evaluations',name:'Evaluaciones sanitarias válidas',icon:Activity,group:'activity',hint:'Fotografías analizadas'},
 {key:'animals',name:'Bovinos evaluados',icon:Beef,group:'activity',hint:'Animales únicos'},
 {key:'ranches',name:'Ranchos evaluados',icon:Warehouse,group:'activity',hint:'Con evaluaciones'},
 {key:'nws_predictions',name:'Predicciones compatibles con miasis',icon:ScanSearch,group:'visual',hint:'Modelo IA, no diagnóstico'},
 {key:'suspected_cases',name:'Casos sospechosos',icon:Stethoscope,group:'suspected',hint:'Valoración profesional'},
 {key:'confirmed_cases',name:'Diagnósticos confirmados',icon:ShieldCheck,group:'confirmed',hint:'Por veterinario'},
 {key:'follow_up_cases',name:'Casos en seguimiento',icon:ClipboardList,group:'follow',hint:'Abiertos'},
 {key:'closed_cases',name:'Casos cerrados',icon:CheckCircle2,group:'closed',hint:'Con cierre profesional'},
]
export default function Observatory({token,onLogin,refreshKey=0,onRanchHistory,embedded=false}) {
 const [filters,setFilters]=useState(defaults),[snapshot,setSnapshot]=useState(null),[geography,setGeography]=useState(null),[error,setError]=useState(''),[geoError,setGeoError]=useState(''),[busy,setBusy]=useState(true),[revision,setRevision]=useState(0),[geoRevision,setGeoRevision]=useState(0)
 const epoch=useRef(0),api=getApiBase()
 useEffect(()=>{const c=new AbortController();fetch(`${import.meta.env.BASE_URL}geo/guerrero-catalog.json`,{signal:c.signal}).then(r=>{if(!r.ok)throw new Error('No se pudo cargar la cartografía oficial');return r.json()}).then(setGeography).catch(e=>{if(e.name!=='AbortError')setGeoError(e.message)});return()=>c.abort()},[geoRevision])
 useEffect(()=>{
  // The previous snapshot stays visible (dimmed) while the next one loads, avoiding flashes; errors clear it.
  const c=new AbortController(),id=++epoch.current;setBusy(true);setError('')
  const query=new URLSearchParams(Object.entries(filters).filter(([,value])=>value))
  fetch(`${api}/observatory${token?'/authorized':''}?${query}`,{headers:token?{Authorization:`Bearer ${token}`}:{},signal:c.signal})
   .then(async r=>{if(!r.ok){let msg;try{msg=(await r.json()).message}catch{}throw new Error(msg||`No se pudo consultar el observatorio (${r.status})`)}return r.json()})
   .then(data=>{if(id===epoch.current)setSnapshot(data)}).catch(e=>{if(e.name!=='AbortError'&&id===epoch.current){setSnapshot(null);setError(e.message)}})
   .finally(()=>{if(id===epoch.current)setBusy(false)})
  return()=>c.abort()
 },[api,token,filters,revision,refreshKey])
 const update=(key,value)=>setFilters(f=>({...f,[key]:value,...(['from','to'].includes(key)?{month:''}:{}),...(key==='region'?{municipality:''}:{})}))
 const selectCategory=value=>update('category',filters.category===value?'':value)
 const summary=snapshot?.summary,maximum=Math.max(1,...(snapshot?.trend||[]).map(p=>Number(p.evaluations)))
 const monthOptions=snapshot?.availableMonths||months()
 const municipalityOptions=useMemo(()=>geography?.municipalities.features.slice().sort((a,b)=>a.properties.name.localeCompare(b.properties.name,'es'))||[],[geography])
 const active=Object.entries(filters).filter(([key,value])=>value&&!(key==='from'&&value===START)&&!(key==='to'&&value===today()))
 const chip=(key,value)=>key==='month'?monthName(value):key==='region'?geography?.regions.find(r=>r.code===value)?.name||value:key==='municipality'?municipalityOptions.find(f=>f.properties.code===value)?.properties.name||value:key==='category'?resultLabel(value):key==='followUp'?clinical[value]:key==='from'?`Desde ${value}`:`Hasta ${value}`
 const caseMax=Math.max(1,...(snapshot?.caseStates||[]).map(r=>Number(r.count)))
 const municipalRows=(snapshot?.municipalities||[]).slice().sort((a,b)=>Number(b.evaluations)-Number(a.evaluations))
 const muniMax=Math.max(1,...municipalRows.map(r=>Number(r.evaluations)))
 const Root=token?'section':'main'
 return <Root className={'observatory'+(embedded?' is-embedded':'')} aria-label={token?'Observatorio autorizado':'Observatorio público'}>
  {!embedded&&<header className="obs-header"><a className="obs-brand" href="#observatorio" aria-label="BoviSafe, observatorio de Guerrero"><span className="obs-logo" aria-hidden="true"><Beef size={20}/></span><span className="obs-wordmark">Bovi<span>Safe</span><small>OBSERVATORIO DE GUERRERO</small></span></a><nav aria-label="Secciones"><a href="#territorio">Territorio</a><a href="#estadisticas">Estadísticas</a><a href="#reportes">Reportes</a>{onLogin&&<button className="obs-login" onClick={onLogin}><LogIn size={16} aria-hidden="true"/>Acceder<span className="login-long"> a mis registros</span></button>}</nav></header>}
  <section className="obs-intro" id="observatorio">
   <div className="obs-intro-copy"><span className="obs-kicker">VIGILANCIA Y SEGUIMIENTO BOVINO · GUERRERO</span><h1>Observar el territorio.<br/><em>Acompañar el cuidado.</em></h1><p>Información operativa registrada desde el 1 de noviembre de 2026. Las predicciones del modelo, las sospechas profesionales y los diagnósticos veterinarios se presentan por separado.</p></div>
   <aside className="obs-intro-card" aria-label="Alcance de la consulta">
    <div className={'obs-scope '+(token?'is-private':'is-public')}>{token?<Lock size={16} aria-hidden="true"/>:<Globe2 size={16} aria-hidden="true"/>}<span>{token?'Vista privada: solo ranchos de tu cuenta o con permiso veterinario.':'Vista pública: agregados municipales sin nombres ni coordenadas privadas.'}</span></div>
    <dl><div><dt>Periodo consultado</dt><dd>{snapshot?`${snapshot.from} a ${snapshot.to}`:busy?'Consultando…':'—'}</dd></div><div><dt>Cartografía</dt><dd>INEGI · 85 municipios</dd></div><div><dt>Actualización</dt><dd>{snapshot?new Date(snapshot.generatedAt).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}):'—'}</dd></div></dl>
   </aside>
  </section>
  <section className="obs-filters-card" aria-label="Filtros del observatorio">
   <div className="obs-filters-head"><span><SlidersHorizontal size={16} aria-hidden="true"/>Filtros de consulta</span>{active.length>0&&<div className="obs-chips" aria-label="Filtros activos">{active.map(([key,value])=><button key={key} type="button" className="obs-chip" onClick={()=>update(key,key==='from'?START:key==='to'?today():'')} aria-label={`Quitar filtro ${chip(key,value)}`}>{chip(key,value)}<span aria-hidden="true">×</span></button>)}</div>}</div>
   <div className="obs-filters">
    <div><label htmlFor="obs-from">Desde</label><input id="obs-from" type="date" min={START} max={today()} value={filters.from} onChange={e=>update('from',e.target.value)}/></div>
    <div><label htmlFor="obs-to">Hasta</label><input id="obs-to" type="date" min={START} max={today()} value={filters.to} onChange={e=>update('to',e.target.value)}/></div>
    <div><label htmlFor="obs-month">Mes</label><select id="obs-month" value={filters.month} onChange={e=>update('month',e.target.value)}><option value="">Todo el periodo</option>{monthOptions.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
    <div><label htmlFor="obs-region">Región declarada</label><select id="obs-region" value={filters.region} onChange={e=>update('region',e.target.value)}><option value="">Todas las regiones</option>{geography?.regions.map(r=><option key={r.code} value={r.code}>{r.name}</option>)}</select></div>
    <div><label htmlFor="obs-municipality">Municipio</label><select id="obs-municipality" value={filters.municipality} onChange={e=>update('municipality',e.target.value)}><option value="">Todos los municipios</option>{municipalityOptions.map(f=><option key={f.properties.code} value={f.properties.code}>{f.properties.name}</option>)}</select></div>
    <div><label htmlFor="obs-category">Clasificación</label><select id="obs-category" value={filters.category} onChange={e=>update('category',e.target.value)}><option value="">Todas las categorías</option>{SANITARY_CODES.map(c=><option key={c} value={c}>{resultLabel(c)}</option>)}</select></div>
    <div><label htmlFor="obs-follow-up">Estado del seguimiento</label><select id="obs-follow-up" value={filters.followUp} onChange={e=>update('followUp',e.target.value)}><option value="">Todos los estados</option>{Object.entries(clinical).map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></div>
    <button type="button" className="obs-reset" onClick={()=>setFilters(defaults())}><RotateCcw size={15} aria-hidden="true"/>Restablecer filtros</button>
   </div>
  </section>
  {(error||geoError)&&<div className="obs-error" role="alert"><strong>{error||geoError}</strong><p>No se muestran datos de demostración ni resultados anteriores para sustituir esta consulta.</p><button onClick={()=>{if(geoError){setGeoError('');setGeoRevision(v=>v+1)}setRevision(v=>v+1)}}>Reintentar consulta</button></div>}
  <section className={'obs-metrics'+(busy&&summary?' is-refreshing':'')} aria-label="Indicadores operativos" aria-busy={busy}>{METRICS.map(({key,name,icon:MetricIcon,group,hint})=><article key={key} className={'metric-'+group}><div className="metric-top"><span className="metric-icon" aria-hidden="true"><MetricIcon size={17}/></span><span className="metric-name">{name}</span></div><strong data-metric={key}>{!summary?'—':Number(summary[key]).toLocaleString('es-MX')}</strong><small>{hint}</small></article>)}</section>
  <section id="territorio" className="obs-section"><div className="obs-section-heading"><div><span>TERRITORIO</span><h2>Mapa de vigilancia de Guerrero</h2></div><span className="obs-period">{busy?'Consultando…':snapshot?`${snapshot.from} a ${snapshot.to}`:'Consulta no disponible'}</span></div>
   <OperationalMap geography={geography} snapshot={snapshot} busy={busy} authorized={!!token} onHistory={onRanchHistory} selectedMunicipality={filters.municipality} onMunicipality={code=>update('municipality',filters.municipality===code?'':code)}/>
   <details className="geo-source"><summary>Cartografía y criterios de visualización</summary><p>Límites estatales y 85 municipios: Marco Geoestadístico del INEGI, simplificado conservando topología. El catálogo de ocho regiones procede del programa oficial estatal. La región se declara en el registro del rancho; no se inventan límites regionales ni se atribuye un municipio completo a Sierra.</p><p>Colores: sin relleno cuando no hay evaluaciones; verde con registros; ámbar con predicciones compatibles con miasis; naranja con sospecha profesional; rojo con confirmación profesional. Describen registros del periodo, no zonas de infestación ni prevalencia. Los casos se cuentan una sola vez; una fotografía de tejido aparentemente sano no los cierra.</p></details>
  </section>
  <section id="estadisticas" className="obs-section"><div className="obs-section-heading"><div><span>ESTADÍSTICAS DEL MISMO PERIODO</span><h2>Información para dar seguimiento</h2></div><button className="obs-refresh" onClick={()=>setRevision(v=>v+1)}><RefreshCw size={15} aria-hidden="true"/>Actualizar consulta</button></div>
   <div className={'obs-charts'+(busy&&snapshot?' is-refreshing':'')}>
    <article><h3>Evaluaciones por mes</h3><p>Selecciona una barra para consultar ese mes.</p><div className="monthly-bars">{snapshot?.trend.map(row=><button key={row.month} className={filters.month===row.month?'chosen':''} title={`${row.month}: ${row.evaluations} evaluaciones, ${row.animals} bovinos evaluados`} aria-label={`${row.month}: ${row.evaluations} evaluaciones`} onClick={()=>update('month',filters.month===row.month?'':row.month)}><strong>{row.evaluations}</strong><span className="bar-track"><i style={{height:`${100*Number(row.evaluations)/maximum}%`}}/></span><small>{row.month}</small></button>)}</div>{!snapshot&&<p className="chart-empty">{busy?'Cargando…':'No disponible'}</p>}</article>
    <article><h3>Clasificaciones del modelo</h3><p>Solo evaluaciones sanitarias válidas; no son diagnósticos veterinarios.</p><div className="category-bars">{snapshot?.categories.filter(row=>SANITARY_CODES.includes(row.category)).map(row=><button key={row.category} className={'cat-'+row.category+(filters.category===row.category?' chosen':'')} onClick={()=>selectCategory(row.category)} title={`${resultLabel(row.category)}: ${row.count} evaluaciones`}><span>{resultLabel(row.category)}</span><i style={{width:`${summary?.evaluations?100*row.count/Number(summary.evaluations):0}%`}}/><strong>{row.count}</strong></button>)}</div>{!snapshot&&<p className="chart-empty">{busy?'Cargando…':'No disponible'}</p>}</article>
    <article><h3>Casos y seguimiento</h3><p>Casos únicos con evaluaciones del periodo; estado profesional actual.</p>{snapshot?.caseStates.length?snapshot.caseStates.map(row=><button className={'case-chart-row status-'+row.status+(filters.followUp===row.status?' chosen':'')} key={row.status} title={`${clinical[row.status]}: ${row.count} casos`} onClick={()=>update('followUp',filters.followUp===row.status?'':row.status)}><span>{clinical[row.status]||row.status}</span><i style={{width:`${100*Number(row.count)/caseMax}%`}}/><strong>{row.count}</strong></button>):<p className="chart-empty">{busy?'Cargando…':'No hay casos operativos para mostrar.'}</p>}</article>
    <article><h3>Evaluaciones por municipio</h3><p>Selecciona un municipio para actualizar mapa y gráficas.</p>{municipalRows.length?<div className="municipal-list">{municipalRows.map(row=><button className={'case-chart-row'+(filters.municipality===row.code?' chosen':'')} key={row.code} disabled={row.code==='UNLOCATED'} title={`${row.evaluations} evaluaciones; ${row.confirmed_cases} casos confirmados`} onClick={()=>update('municipality',filters.municipality===row.code?'':row.code)}><span>{row.name}</span><i style={{width:`${100*Number(row.evaluations)/muniMax}%`}}/><strong>{row.evaluations}</strong></button>)}</div>:<p className="chart-empty">{busy?'Cargando…':'No hay evaluaciones operativas por municipio.'}</p>}</article>
   </div>
  </section>
  <Reports token={token} geography={geography} months={monthOptions} start={START} end={today()} onLogin={onLogin} observatoryFilters={filters}/>
  <footer className="obs-footer"><div><strong>Bovi<span>Safe</span></strong><p>Una posible lesión compatible con miasis requiere valoración veterinaria. El tejido aparentemente sano no garantiza ausencia de enfermedad. Ante sospecha de gusano barrenador, notifica al SENASICA. Los registros de pruebas están excluidos de todas las consultas operativas.</p></div><small>Guerrero · Marco Geoestadístico INEGI · {snapshot?'Datos consultados: '+new Date(snapshot.generatedAt).toLocaleString('es-MX'):'Sin consulta operativa disponible'}</small></footer>
 </Root>
}
