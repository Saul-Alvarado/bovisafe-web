import { useMemo, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowRight, BarChart3, CalendarDays, CheckCircle2,
  ChevronDown, ChevronRight, Compass, Download, HeartPulse, Info, Leaf, Map as MapIcon,
  MapPin, Menu, Search, ShieldCheck, SlidersHorizontal, Sparkles, TrendingUp, Users,
  X, AlertTriangle, CircleDot, RefreshCw, Layers3
} from 'lucide-react'
import TerritoryMap from './components/TerritoryMap.jsx'
import TimeNavigator from './components/TimeNavigator.jsx'
import { snapshotRanches, monthlyTrend, periodLabel, MONTHS } from './data/history.js'
import { ranches, zoneMetadata, RISKS, countRisks, fmt } from './data/mockData.js'

const regionById=Object.fromEntries(zoneMetadata.map(z=>[z.id,z.nombre]))

function Logo({light=false}) {
  return <div className={`logo-lockup ${light?'logo-lockup-light':''}`}>
    <span className="brand-mark"><ShieldCheck size={23} strokeWidth={2}/><span className="brand-spark">✦</span></span>
    <span className="brand-name">Bovi<span>Safe</span><small>OBSERVATORIO</small></span>
  </div>
}
function StatusPill({children,tone='neutral',icon:Icon}) {
  return <span className={`status-pill status-${tone}`}>{Icon&&<Icon size={13}/>} {children}</span>
}
function StatCard({label,value,sub,icon:Icon,tone='mint',trend}) {
  return <article className={`metric-card metric-${tone}`}>
    <div className="metric-top"><span className="metric-label">{label}</span><span className="metric-icon"><Icon size={20} strokeWidth={1.8}/></span></div>
    <strong className="metric-value">{fmt(value)}</strong>
    <div className="metric-bottom"><span>{sub}</span>{trend&&<span className="metric-tiny-icon"><ArrowRight size={14}/></span>}</div>
  </article>
}
function Sidebar() {
  const [open,setOpen]=useState(false)
  const nav=[{id:'inicio',label:'Inicio',icon:Compass},{id:'mapa',label:'Mapa territorial',icon:MapIcon},{id:'estadisticas',label:'Estadísticas',icon:BarChart3},{id:'acerca-de',label:'Sobre BoviSafe',icon:Info}]
  return <>
    <button className="mobile-menu-toggle" aria-label={open?'Cerrar menú':'Abrir menú'} onClick={()=>setOpen(v=>!v)}><Menu size={21}/></button>
    {open&&<div className="mobile-menu-backdrop" onClick={()=>setOpen(false)} />}
    <aside className={`app-sidebar ${open?'sidebar-open':''}`}>
      <div className="sidebar-top"><Logo light/><p>Una mirada al bienestar bovino.</p></div>
      <div className="sidebar-label">EXPLORAR</div>
      <nav className="sidebar-nav">{nav.map((n,i)=><a key={n.id} className={`nav-link ${i===1?'nav-link-featured':''}`} href={`#${n.id}`} onClick={()=>setOpen(false)}><n.icon size={18}/><span>{n.label}</span>{i===1&&<span className="nav-active-dot"/>}</a>)}</nav>
      <div className="sidebar-spacer"/>
      <div className="sidebar-note"><span className="sidebar-note-flower">✳</span><strong>Cuidar comienza con observar.</strong><p>Una herramienta para organizar el seguimiento en el territorio.</p><span className="sidebar-note-line"/></div>
      <div className="sidebar-footer"><span className="sidebar-footer-dot"/> Prototipo académico · Guerrero</div>
    </aside>
  </>
}

function FarmRow({ranch,selected,onClick}) {
  return <button className={`farm-row ${selected?'farm-row-selected':''}`} onClick={onClick} type="button" aria-pressed={selected}>
    <span className="farm-row-icon"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10 12 3l9 7"/><path d="M5 9v12h14V9"/><path d="M9 21v-8h6v8"/></svg></span>
    <span className="farm-row-text"><strong>{ranch.nombre}</strong><small><MapPin size={12}/>{ranch.localidad}</small></span>
    <span className={`farm-row-risk ${ranch.alertas?'farm-row-risk-active':'farm-row-risk-clear'}`}><strong>{ranch.alertas}</strong><small>alertas</small></span>
    <ChevronRight className="farm-row-chevron" size={16}/>
  </button>
}
function RanchDetails({ranch,onClose,onSimulate,onRestore,historyMode}) {
  const breakdown=countRisks([ranch]);
  return <div className="ranch-detail">
    <div className="ranch-detail-heading"><span>EXPEDIENTE DEMOSTRATIVO</span><button aria-label="Cerrar detalle" onClick={onClose}><X size={17}/></button></div>
    <h3>{ranch.nombre}</h3><p><MapPin size={14}/>{ranch.localidad}, Guerrero</p>
    <div className="ranch-detail-summary"><div><strong>{ranch.bovinos}</strong><span>Bovinos evaluados</span></div><div><strong>{ranch.alertas}</strong><span>Requieren atención</span></div></div>
    <div className="risk-bars">{Object.entries(breakdown).map(([risk,num])=><div className="risk-bar-row" key={risk}><span className="risk-dot" style={{background:RISKS[risk].color}}/><span>{RISKS[risk].label}</span><div className="bar-track"><i style={{width:`${ranch.bovinos?100*num/ranch.bovinos:0}%`,background:RISKS[risk].color}}/></div><strong>{num}</strong></div>)}</div>
    <div className="detail-foot"><CalendarDays size={13}/> Periodo ficticio: {ranch.fecha}</div>
    <div className="detail-coords"><MapPin size={13}/> {ranch.lat.toFixed(4)}, {ranch.lng.toFixed(4)} <span>•</span> coordenadas de ejemplo</div>
    <span className="detail-caution">La alerta no equivale a diagnóstico ni a infección confirmada.</span>
    {historyMode==='current'&&<div className="ranch-demo-actions"><button type="button" onClick={()=>onSimulate(ranch.id)}><Activity size={14}/> Simular nueva alerta</button><button type="button" onClick={onRestore} aria-label="Restaurar datos de demostración"><RefreshCw size={14}/></button></div>}
  </div>
}
function MiniLineChart({series,activeMonths}) {
  const width=650,height=216,l=42,r=20,t=17,b=37
  const max=Math.max(5,...series.map(p=>p.alertas))
  const ceiling=Math.ceil(max/5)*5+2
  const coords=series.map((p,i)=>[l+(width-l-r)*i/(series.length-1),t+(height-t-b)*(1-p.alertas/ceiling)])
  const line=coords.map(([x,y],i)=>`${i?'L':'M'}${x},${y}`).join(' ')
  const area=`${line} L${coords[coords.length-1][0]},${height-b} L${coords[0][0]},${height-b} Z`
  return <div className="trend-plot"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Evolución mensual simulada de bovinos con alertas, de junio a noviembre 2026: ${series.map(m=>`${m.label} ${m.alertas}`).join(', ')}`}>
    <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#78b6a2" stopOpacity=".26"/><stop offset="100%" stopColor="#78b6a2" stopOpacity=".015"/></linearGradient></defs>
    {[0,1,2,3,4].map(i=>{const v=Math.round(ceiling*i/4);const y=height-b-(height-t-b)*i/4;return <g key={i}><line x1={l} y1={y} x2={width-r} y2={y} stroke="#e6eee9" strokeDasharray="3 6"/><text x={l-12} y={y+4} textAnchor="end" fill="#9aada5" fontSize="11">{v}</text></g>})}
    <path d={area} fill="url(#trendFill)"/><path d={line} fill="none" stroke="#408f78" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"/>
    {coords.map(([x,y],i)=>{const active=activeMonths.includes(series[i].id);return <g key={series[i].id} opacity={active?1:.56}><circle cx={x} cy={y} r={active?6.4:4.2} fill={active?'#438f78':'#fff'} stroke="#438f78" strokeWidth="2.8"/><text x={x} y={y-14} textAnchor="middle" fill="#438f78" fontSize="11" fontWeight="700">{series[i].alertas}</text><text x={x} y={height-9} textAnchor="middle" fill="#899c94" fontSize="11.5">{series[i].short}</text><title>{series[i].label}: {series[i].alertas} alertas ficticias</title></g>})}
  </svg></div>
}
function RiskDonut({counts}) {
  const total=Object.values(counts).reduce((a,b)=>a+b,0)
  let running=0
  const parts=Object.keys(RISKS).map(k=>{
    const start=running;running+=total?100*counts[k]/total:0;
    return `${RISKS[k].color} ${start}% ${running}%`
  })
  return <div className="risk-donut-layout"><div className="risk-donut" style={{background:`conic-gradient(${parts.join(',')})`}}><div className="risk-donut-center"><strong>{total}</strong><small>evaluaciones</small></div></div><div className="risk-donut-legend">{Object.entries(counts).map(([risk,num])=><div key={risk}><i style={{background:RISKS[risk].color}}/><span>{RISKS[risk].label}</span><strong>{num}</strong></div>)}</div></div>
}
function exportDemoCsv(items) {
  const rows=[['id_rancho','rancho','municipio','latitud','longitud','bovinos_evaluados','riesgo_alto_o_critico','datos_simulados'],...items.map(r=>[r.id,r.nombre,r.municipio,r.lat,r.lng,r.bovinos,r.alertas,'SI'])]
  const q=v=>`"${String(v).replaceAll('"','""')}"`
  const csv='\ufeff'+rows.map(row=>row.map(q).join(',')).join('\r\n')
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}))
  const anchor=document.createElement('a');anchor.href=url;anchor.download='bovisafe-ranchos-demo.csv';document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
}

export default function App() {
  const [demoRanches,setDemoRanches]=useState(ranches)
  const [zone,setZone]=useState('all')
  const [selectedRanch,setSelectedRanch]=useState(null)
  const [colorMode,setColorMode]=useState('risk')
  const [filter,setFilter]=useState('all')
  const [search,setSearch]=useState('')
  const [showAllZones,setShowAllZones]=useState(false)
  const [timeMode,setTimeMode]=useState('current')
  const [timeMonth,setTimeMonth]=useState('2026-10')
  const [timeFrom,setTimeFrom]=useState('2026-10')
  const [timeTo,setTimeTo]=useState('2026-11')
  const selectedTime={mode:timeMode,month:timeMonth,from:timeFrom,to:timeTo}
  const timeRanches=useMemo(()=>snapshotRanches(demoRanches,selectedTime),[demoRanches,timeMode,timeMonth,timeFrom,timeTo])
  const chartSeries=useMemo(()=>monthlyTrend(demoRanches,zone),[demoRanches,zone])
  const activeMonths=timeMode==='current'?['2026-11']:timeMode==='month'?[timeMonth]:MONTHS.filter(m=>m.id>=timeFrom&&m.id<=timeTo).map(m=>m.id)
  const timeCaption=periodLabel(selectedTime)
  const zoneTotals=useMemo(()=>zoneMetadata.map(z=>({...z,ranchos:timeRanches.filter(r=>r.zona===z.id).length,alertas:timeRanches.filter(r=>r.zona===z.id).reduce((a,r)=>a+r.alertas,0)})),[timeRanches])
  const scopedRanches=useMemo(()=>zone==='all'?timeRanches:timeRanches.filter(r=>r.zona===zone),[zone,timeRanches])
  const displayedRanches=useMemo(()=>scopedRanches.filter(r=>{
    const matchesFilter=filter==='all'||(filter==='alerts'?r.alertas>0:r.alertas===0)
    const text=`${r.nombre} ${r.localidad} ${r.municipio}`.toLocaleLowerCase('es-MX')
    return matchesFilter&&text.includes(search.toLocaleLowerCase('es-MX').trim())
  }),[scopedRanches,filter,search])
  const scopedCounts=useMemo(()=>countRisks(scopedRanches),[scopedRanches])
  const scopedBovinos=scopedRanches.reduce((n,r)=>n+r.bovinos,0)
  const scopedWarnings=scopedRanches.reduce((n,r)=>n+r.alertas,0)
  const currentRanch=timeRanches.find(r=>r.id===selectedRanch)
  const setZoneAndClear=id=>{setZone(id);setSelectedRanch(null)}
  const selectRanch=id=>{setSelectedRanch(id)}
  const reset=()=>{setZone('all');setSelectedRanch(null);setFilter('all');setSearch('');setTimeMode('current');setTimeMonth('2026-10');setTimeFrom('2026-10');setTimeTo('2026-11')}
  const simulateAlert=(id)=>setDemoRanches(previous=>previous.map(r=>{
    if(r.id!==id) return r
    const idx=r.animales.findIndex(a=>a.riesgo==='bajo')
    if(idx<0) return r
    const animales=r.animales.map((a,i)=>i===idx?{...a,riesgo:'alto',evaluacion:'09 nov 2026 (simulación)'}:a)
    return {...r,animales,alertas:animales.filter(a=>a.riesgo==='alto'||a.riesgo==='critico').length,fecha:'09 nov 2026 (simulación)'}
  }))
  return <div className="app-shell">
    <Sidebar/>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><span>Plataforma pública</span><ChevronRight size={14}/><strong>Observatorio territorial</strong></div><div className="topbar-right"><span className="topbar-demo"><span/> Entorno demostrativo</span><span className="topbar-avatar"><Leaf size={17}/></span></div></header>
      <div className="content">
        <section className="hero" id="inicio"><div className="hero-copy"><span className="hero-eyebrow"><span>✳</span> BOVISAFE · GUERRERO, MÉXICO</span><h1>El bienestar animal<br/><em>también se puede visualizar.</em></h1><p>Un vistazo al territorio, sus ranchos y el seguimiento de bovinos. Datos que ayudan a observar, comprender y actuar a tiempo.</p><a href="#mapa" className="hero-button">Explorar el mapa <ArrowRight size={17}/></a></div><div className="hero-art" aria-hidden="true"><div className="hero-ring ring1"/><div className="hero-ring ring2"/><div className="hero-ring ring3"/><div className="hero-cow-circle"><svg viewBox="0 0 140 140" width="138" height="138" fill="none"><path d="M38 39c-11-13-20-11-22-4-1 9 9 21 20 22M102 39c11-13 20-11 22-4 1 9-9 21-20 22" fill="#f6e7c2" stroke="#315748" strokeWidth="4" strokeLinecap="round"/><path d="M37 53c-2-26 14-38 33-38s35 12 33 38l-3 42c-1 21-13 33-30 33S41 116 40 95Z" fill="#f8f5df" stroke="#315748" strokeWidth="4"/><path d="M46 25c4 13 9 16 15 20M95 25c-4 13-9 16-15 20" stroke="#87b59a" strokeWidth="9" strokeLinecap="round"/><path d="M47 79c-12 2-15-5-10-14 6-11 14-10 22-2 7 7 3 14-12 16" fill="#91bda4"/><circle cx="55" cy="69" r="4.7" fill="#315748"/><circle cx="85" cy="69" r="4.7" fill="#315748"/><path d="M41 97c0-11 12-20 29-20s29 9 29 20-13 22-29 22-29-11-29-22" fill="#e5b4a4" stroke="#315748" strokeWidth="3"/><ellipse cx="57" cy="97" rx="4.5" ry="6.5" fill="#9e6a63"/><ellipse cx="83" cy="97" rx="4.5" ry="6.5" fill="#9e6a63"/></svg></div><span className="hero-star hero-star-a">✦</span><span className="hero-star hero-star-b">✳</span><span className="hero-art-label">Cuidado con propósito <span>↗</span></span></div></section>
        <div className="section-heading stats-heading"><div><span className="eyebrow">PANORAMA GENERAL</span><h2>Así se ve el territorio <span>{timeMode==='current'?'hoy':'en el tiempo'}</span></h2></div><div className="heading-extras"><StatusPill tone="simulation" icon={Info}>Cifras de ejemplo</StatusPill><span className="section-date"><CalendarDays size={15}/> {timeCaption}</span></div></div>
        <section className="stats-grid" aria-label="Indicadores principales"><StatCard label="Ranchos en el mapa" value={scopedRanches.length} sub="Ubicaciones simuladas" icon={MapPin} tone="green"/><StatCard label="Bovinos evaluados" value={scopedBovinos} sub={timeMode==='range'?'Bovinos únicos por periodo':'Un registro por bovino'} icon={Activity} tone="mint"/><StatCard label="Requieren atención" value={scopedWarnings} sub="Riesgo alto o crítico · simulado" icon={HeartPulse} tone="peach"/><StatCard label="Zonas representadas" value={zone==='all'?zoneMetadata.length:1} sub="Divisiones ilustrativas" icon={Layers3} tone="lime"/></section>
        <section id="mapa" className="map-section">
          <div className="section-heading"><div><span className="eyebrow">EXPLORA GUERRERO</span><h2>Mapa territorial <span className="heading-decoration">✳</span></h2><p>Selecciona un rancho o una zona para ver sus datos.</p></div><button type="button" className="subtle-button" onClick={reset}><RefreshCw size={16}/> Restablecer vista</button></div>
          <TimeNavigator mode={timeMode} onModeChange={setTimeMode} month={timeMonth} onMonthChange={setTimeMonth} from={timeFrom} onFromChange={setTimeFrom} to={timeTo} onToChange={setTimeTo}/>
          <div className="map-layout"><article className="map-panel"><div className="map-panel-toolbar"><div className="map-mode-label"><span className="live-sim-dot"/> Mapa interactivo <span className="hide-small">· {zone==='all'?'Todo Guerrero':regionById[zone]}</span></div><div className="segment-switch" role="group" aria-label="Color del mapa"><button className={colorMode==='risk'?'chosen':''} aria-pressed={colorMode==='risk'} onClick={()=>setColorMode('risk')}>Alertas</button><button className={colorMode==='zones'?'chosen':''} aria-pressed={colorMode==='zones'} onClick={()=>setColorMode('zones')}>Zonas</button></div></div><TerritoryMap ranches={displayedRanches} allRanches={timeRanches} selectedRanch={selectedRanch} selectedZone={zone==='all'?null:zone} onSelectRanch={selectRanch} onSelectZone={setZoneAndClear} onReset={reset} colorMode={colorMode}/><div className="map-bottom-note"><Info size={14}/> Colores y conteos simulados según el periodo. Las ocho regiones siguen siendo ilustrativas. <span>Desplaza y amplía el mapa.</span></div></article>
            <aside className="ranches-panel"><div className="ranches-panel-title"><div><span className="eyebrow">PUNTOS DE OBSERVACIÓN</span><h3>Ranchos en seguimiento <span>{displayedRanches.length}</span></h3></div><SlidersHorizontal size={19}/></div><div className="ranch-search"><Search size={17}/><input aria-label="Buscar rancho o municipio" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar rancho o municipio..."/>{search&&<button aria-label="Limpiar búsqueda" onClick={()=>setSearch('')}><X size={15}/></button>}</div><div className="farm-filters"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>Todos</button><button className={filter==='alerts'?'active':''} onClick={()=>setFilter('alerts')}>Con alertas</button><button className={filter==='safe'?'active':''} onClick={()=>setFilter('safe')}>Sin alertas</button></div>
              <div className="farm-list">{displayedRanches.length?displayedRanches.map(r=><FarmRow key={r.id} ranch={r} selected={selectedRanch===r.id} onClick={()=>selectRanch(r.id)}/>):<div className="empty-farms"><Search size={26}/><strong>No hay ranchos con ese filtro</strong><span>Prueba otra búsqueda o restablece la vista.</span><button onClick={reset}>Ver todos</button></div>}</div>
              {currentRanch&&<RanchDetails ranch={currentRanch} onClose={()=>setSelectedRanch(null)} onSimulate={simulateAlert} onRestore={()=>setDemoRanches(ranches)} historyMode={timeMode}/>}
              <div className="ranches-panel-footer"><div className="panel-safety-mark"><ShieldCheck size={17}/></div><p>Los conteos provienen de evaluaciones de prueba, no de diagnósticos confirmados.</p></div>
            </aside></div>
        </section>
        <section className="analytics-section" id="estadisticas"><div className="section-heading"><div><span className="eyebrow">LA INFORMACIÓN TAMBIÉN CUENTA HISTORIAS</span><h2>Estadísticas de seguimiento</h2><p>Indicadores ficticios para anticipar el diseño del portal público.</p></div><button onClick={()=>exportDemoCsv(scopedRanches)} className="subtle-button"><Download size={16}/> Exportar CSV demo</button></div>
          <div className="charts-grid"><article className="analytics-card trend-card"><div className="analytics-card-heading"><div><span className="analytics-kicker">EVOLUCIÓN MENSUAL · JUN–NOV 2026</span><h3>Bovinos con alertas por mes</h3><p>Meses resaltados según el periodo consultado.</p></div><span className="chart-icon-box"><TrendingUp size={20}/></span></div><MiniLineChart series={chartSeries} activeMonths={activeMonths}/><div className="chart-foot-note"><span><i/> Alertas por mes</span><small>Cada mes contabiliza una vez a cada bovino</small></div></article><article className="analytics-card donut-card"><div className="analytics-card-heading"><div><span className="analytics-kicker">{timeMode==='range'?'MAYOR RIESGO EN EL RANGO':'ESTADO POR BOVINO'}</span><h3>Distribución del riesgo</h3><p>{timeCaption} · {zone==='all'?'Todo Guerrero':'Zona seleccionada'}</p></div><span className="chart-icon-box"><Activity size={20}/></span></div><RiskDonut counts={scopedCounts}/><div className="donut-foot"><span><span className="donut-foot-dot"/> {fmt(scopedWarnings)} bovinos requieren atención</span><small>Simulación, no diagnóstico</small></div></article></div>
          <article className="region-card"><div className="region-card-header"><div><span className="eyebrow">EXPLORA POR TERRITORIO</span><h3>Zonas de observación</h3><p>Distribución ilustrativa del prototipo. Elige una para enfocar el mapa.</p></div><span className="region-card-icon"><MapIcon size={23}/></span></div><div className="region-grid">{zoneTotals.slice(0,showAllZones?8:4).map(z=><button key={z.id} className={`zone-tile ${zone===z.id?'zone-tile-selected':''}`} onClick={()=>{setZoneAndClear(zone===z.id?'all':z.id);document.getElementById('mapa')?.scrollIntoView({behavior:'smooth',block:'start'})}}><span className="zone-tile-leading"><i style={{background:z.color}}/>{z.nombre}</span><strong>{z.alertas} <small>alertas</small></strong><span className="zone-tile-sub">{z.ranchos} {z.ranchos===1?'rancho de ejemplo':'ranchos de ejemplo'}</span></button>)}</div><button className="see-all-regions" onClick={()=>setShowAllZones(v=>!v)}>{showAllZones?'Ver menos zonas':'Ver las 8 zonas'} <ChevronDown size={16} className={showAllZones?'up':''}/></button></article>
        </section>
        <section className="about-card" id="acerca-de"><div className="about-icon"><Leaf size={26}/></div><div><span className="eyebrow">SOBRE BOVISAFE</span><h2>Datos para acompañar mejores decisiones.</h2><p>BoviSafe es un proyecto académico de seguimiento y vigilancia de lesiones compatibles con miasis en bovinos de Guerrero. Esta versión pública es una maqueta con cifras, ranchos, coordenadas y evaluaciones completamente ficticios. No muestra contagios ni casos sanitarios confirmados.</p></div><a href="#mapa" className="about-link">Volver al mapa <ArrowRight size={17}/></a></section>
        <footer className="footer"><Logo/><span>Prototipo demostrativo · 2026 · Guerrero, México</span><span>Hecho para el bienestar animal <span className="footer-heart">♥</span></span></footer>
      </div>
    </main>
  </div>
}
