import {resultLabel,evaluable,recommendations,resultExplanation} from '../resultLabels.js'
import { useEffect, useState, useRef } from 'react'
import { getApiBase } from '../apiConfig.js'
import Observatory from './Observatory.jsx'
import { ArrowLeft, Beef, Lock, LogOut, RefreshCw, UserRound } from 'lucide-react'
const diagnoses = { UNASSESSED: 'Sin valoración profesional', SUSPECTED: 'Sospecha profesional', CONFIRMED: 'Confirmado por profesional', DISCARDED: 'Descartado por profesional', UNDETERMINED: 'No concluyente' }
export default function OperationalPortal({onExit}) {
  const API=getApiBase()
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rows, setRows] = useState([])
  const [assigned, setAssigned] = useState([])
  const [summary, setSummary] = useState(null)
  const [monthly,setMonthly]=useState([])
  const [origin,setOrigin]=useState('OPERATIONAL')
  const [refreshKey,setRefreshKey]=useState(0)
  const generation=useRef(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [animal, setAnimal] = useState('all')
  const [ranchFilter,setRanchFilter]=useState(null)
  const [selected, setSelected] = useState(null)
  const [notes, setNotes] = useState('')
  const [next, setNext] = useState('')
  const [diagnosis, setDiagnosis] = useState('UNDETERMINED')
  const [reviews, setReviews] = useState([])
  const [reviewVersion,setReviewVersion]=useState(0)
  const [photo, setPhoto] = useState(null)
  async function request(path, options = {}, auth = session) {
    const response = await fetch(`${API}${path}`, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(auth ? { Authorization: `Bearer ${auth.token}` } : {}), ...options.headers } })
    if (response.status === 401) { setSession(null); setRows([]); setAssigned([]); setSelected(null); throw new Error('Inicia sesión para continuar.') }
    if (!response.ok) { let message; try { message = (await response.json()).message } catch {} throw new Error(message || `No se pudo completar la solicitud (${response.status}).`) }
    return response.json()
  }
  async function refresh(auth = session) {
    const epoch=++generation.current
    setLoading(true); setError('')
    try {
      const [data, clinical] = await Promise.all([request('/evaluations', {}, auth),request('/clinical/evaluations', {}, auth)])
      if(epoch!==generation.current)return
      setRows(data); setAssigned(clinical);setRefreshKey(v=>v+1)
    } catch (e) { if(epoch===generation.current)setError(e.message) } finally { if(epoch===generation.current)setLoading(false) }
  }
  async function login(e) {
    e.preventDefault(); setLoading(true); setError('')
    try { const auth = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, null); setPassword(''); setSession(auth); await refresh(auth) }
    catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  useEffect(() => {
    let url; const controller = new AbortController(); setPhoto(null); setReviews([])
    if (selected && session) {
      request(`/clinical/evaluations/${selected.id}/reviews`, { signal: controller.signal }).then(setReviews).catch(e => { if(e.name !== 'AbortError') setError(e.message) })
      const imagePath = rows.some(r => r.id === selected.id) ? `/evaluations/${selected.id}/image` : `/clinical/evaluations/${selected.id}/image`
      fetch(`${API}${imagePath}`, { headers: { Authorization: `Bearer ${session.token}` }, signal: controller.signal })
        .then(r => { if(!r.ok) throw new Error('Fotografía no disponible'); return r.blob() }).then(blob => { url = URL.createObjectURL(blob); setPhoto(url) }).catch(e => { if(e.name !== 'AbortError') setError(e.message) })
    }
    return () => { controller.abort(); if(url) URL.revokeObjectURL(url) }
  }, [selected?.id, session?.token, reviewVersion])
  async function select(row) { setSelected(row); setNotes(row.observations || ''); setNext(row.nextReviewAt?.slice(0,16) || ''); setError('') }
  async function save(clinical = false, close = false) {
    setLoading(true); setError('')
    try {
      const updated = await request(clinical ? `/clinical/evaluations/${selected.id}/reviews` : `/evaluations/${selected.id}/follow-up`, { method: clinical ? 'POST' : 'PUT', body: JSON.stringify(clinical ? { diagnosis, notes, nextReviewAt: next || null, close } : { observations: notes, nextReviewAt: next || null }) })
      await select(updated); if(clinical)setReviewVersion(v=>v+1); await refresh()
    } catch(e) { setError(e.message) } finally { setLoading(false) }
  }
  const combined = [...new Map([...rows, ...assigned].map(r => [r.id, r])).values()].filter(r=>(r.dataOrigin||('SIMULATED'===r.analysisSource?'TEST':'OPERATIONAL'))===origin).sort((a,b) => b.createdAt.localeCompare(a.createdAt))
  const animals = [...new Map(combined.map(r => [r.cattleId, r.identifier])).entries()]
  const filtered = combined.filter(r => (animal === 'all' || String(r.cattleId) === animal) && (ranchFilter===null || String(r.ranchId)===String(ranchFilter)))
  const isVet = selected && assigned.some(r => r.id === selected.id)
  const isOwner = selected && rows.some(r => r.id === selected.id)
  return <main className="operational-portal">
    <header className="portal-header">
      <div className="portal-brand"><span className="obs-logo" aria-hidden="true"><Beef size={20}/></span><div><h1>Bovi<span>Safe</span> · Evaluaciones y seguimiento</h1><small>Portal privado de productores y veterinarios</small></div></div>
      <div className="portal-header-actions">{onExit&&<button type="button" className="portal-return" onClick={onExit}><ArrowLeft size={15} aria-hidden="true"/>Volver al observatorio</button>}
      {session&&<div className="portal-toolbar">{session.firstName&&<span className="portal-user"><UserRound size={15} aria-hidden="true"/>{session.firstName}</span>}<button disabled={loading} onClick={()=>refresh()}><RefreshCw size={15} aria-hidden="true"/>Actualizar</button><button className="danger" onClick={()=>{generation.current++;setMonthly([]);setSession(null);setRows([]);setAssigned([]);setSelected(null);setSummary(null)}}><LogOut size={15} aria-hidden="true"/>Cerrar sesión</button></div>}</div>
    </header>
    <p className="portal-lead">Predicción experimental, sospecha y diagnóstico profesional se registran por separado. Una posible lesión compatible con miasis requiere valoración veterinaria; el tejido aparentemente sano no garantiza ausencia de enfermedad.</p>
    {error && <p role="alert" className="portal-error">{error}</p>}
    {!session ? <div className="portal-login-wrap"><form onSubmit={login} className="portal-login"><span className="portal-login-icon" aria-hidden="true"><Lock size={22}/></span><h2>Acceso a tus registros</h2><p>Usa la misma cuenta de la aplicación BoviSafe para Android.</p><label>Correo<input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Contraseña<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary" disabled={loading}>{loading?'Conectando…':'Iniciar sesión'}</button><small>Tu sesión se conserva solo en esta pestaña.</small></form></div> : <>
      <Observatory embedded token={session.token} refreshKey={refreshKey} onRanchHistory={id=>{setRanchFilter(id);setAnimal('all');setSelected(null);setTimeout(()=>document.getElementById('history-section')?.scrollIntoView({behavior:'smooth',block:'start'}),0)}}/>
      <section className="portal-history" id="history-section" aria-labelledby="history-title">
        <div className="portal-history-head"><div><span className="obs-kicker">HISTORIAL</span><h2 id="history-title">Evaluaciones registradas</h2></div>
          <div className="portal-history-filters">
            <div><label htmlFor="history-origin">Origen del historial</label><select id="history-origin" value={origin} onChange={e=>{setOrigin(e.target.value);setAnimal('all');setSelected(null);setRanchFilter(null)}}><option value="OPERATIONAL">Registros operativos</option><option value="TEST">Pruebas (solo auditoría)</option></select></div>
            <div><label htmlFor="animal-filter">Bovino</label><select id="animal-filter" value={animal} onChange={e=>setAnimal(e.target.value)}><option value="all">Todos</option>{animals.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></div>
          </div>
        </div>
        {ranchFilter!==null&&<p className="portal-notice">Historial filtrado por el rancho seleccionado. <button onClick={()=>setRanchFilter(null)}>Mostrar todos los ranchos</button></p>}
        {origin==='TEST'&&<p role="note" className="portal-notice warn">Auditoría de pruebas. Estos registros están excluidos del mapa, indicadores y estadísticas operativas.</p>}
        <div className="portal-table"><table><caption>Historial {origin==='TEST'?'de pruebas':'operativo'}: {filtered.length} evaluaciones. Las alertas no son diagnósticos confirmados.</caption><thead><tr><th>Fecha (UTC)</th><th>Bovino / Rancho</th><th>Predicción / Modelo</th><th>Puntuación</th><th>Diagnóstico profesional</th><th>Seguimiento</th><th>Reporte</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id} className={selected?.id===r.id?'is-selected':''}><td className="nowrap">{r.createdAt.replace('T',' ')}</td><td><strong>{r.identifier}</strong><br/><small>{r.ranchName}</small></td><td><span className={'result-pill result-'+r.result}>{r.dataOrigin==='TEST'&&<strong>PRUEBA · </strong>}{resultLabel(r.result)}</span>{!evaluable(r.result)&&<small> · Análisis no evaluable</small>}<br/><small>{r.modelVersion || r.analysisSource}</small></td><td className="num">{(r.confidence*100).toFixed(1)} %</td><td>{diagnoses[r.clinicalDiagnosis] || 'Sin valoración'}</td><td>{r.status==='RESOLVED'?'Cerrado':r.requiresFollowUp?'Requiere atención':'Registrado'}<br/><small>{r.nextReviewAt?.replace('T',' ')}</small></td><td><button onClick={()=>select(r)}>Ver</button></td></tr>)}</tbody></table></div>
        {!loading && !combined.length && <p className="portal-empty">No hay evaluaciones registradas para esta cuenta. Las evaluaciones pendientes en Android aparecerán después de sincronizarse.</p>}
      </section>
      {selected && <section className="portal-report" aria-label="Reporte de la evaluación"><div className="portal-report-head"><h2>{selected.identifier} · {resultLabel(selected.result)}</h2><button onClick={()=>setSelected(null)}>Cerrar reporte</button></div>
        <div className="portal-report-grid"><div className="portal-report-photo">{photo ? <img src={photo} alt="Fotografía de la evaluación"/> : <span>Cargando fotografía…</span>}</div><div>
        {!evaluable(selected.result)&&<p role="note" className="portal-notice warn">Análisis no evaluable. Repite la fotografía para obtener una evaluación sanitaria.</p>}<p>{resultExplanation(selected.result)}</p><p>Puntuación del modelo: {(selected.confidence*100).toFixed(1)} %. No es una probabilidad clínica.</p><p className="portal-advice">{recommendations(selected.recommendation)}</p><p className="portal-meta">Modelo: {selected.modelVersion || selected.analysisSource}. Puntuaciones del clasificador; no son probabilidades clínicas.</p><dl className="portal-scores">{['NWS','HEALTHY','LESION','ENVIRONMENT','POOR_QUALITY','OCCLUSION'].filter(label=>selected.scores?.[label]!==undefined).map(label=><div key={label}><dt>{resultLabel(label)}</dt><dd>{(selected.scores[label]*100).toFixed(2)} %</dd></div>)}</dl><p className="portal-meta">Reglas: {selected.rulesVersion || 'Registro anterior'}</p></div></div>
        <div className="portal-followup"><label htmlFor="evaluation-observations">Observaciones</label><textarea id="evaluation-observations" maxLength={10000} value={notes} onChange={e=>setNotes(e.target.value)}/><label htmlFor="evaluation-next-review">Próxima revisión (UTC)</label><input id="evaluation-next-review" type="datetime-local" value={next} onChange={e=>setNext(e.target.value)}/>
        {isOwner && <button className="primary" disabled={loading} onClick={()=>save()}>Guardar seguimiento</button>}
        {isVet && evaluable(selected.result) && <div className="portal-vet"><label htmlFor="professional-diagnosis">Valoración profesional</label><select id="professional-diagnosis" value={diagnosis} onChange={e=>setDiagnosis(e.target.value)}>{['SUSPECTED','CONFIRMED','DISCARDED','UNDETERMINED'].map(v=><option key={v} value={v}>{diagnoses[v]}</option>)}</select><button className="primary" disabled={loading || !notes.trim()} onClick={()=>save(true)}>Registrar valoración</button><button disabled={loading || !notes.trim() || !['CONFIRMED','DISCARDED'].includes(diagnosis)} onClick={()=>save(true,true)}>Registrar valoración y cerrar seguimiento</button></div>}</div>
        <h3>Valoraciones veterinarias</h3>{reviews.length ? reviews.map(r=><article key={r.id} className="portal-review"><strong>{diagnoses[r.diagnosis]}</strong><p>{r.notes}</p><small>{r.created_at} · profesional #{r.veterinarian_id}{r.closed?' · cierre autorizado':''}</small></article>) : <p className="portal-empty">Sin valoración profesional registrada.</p>}
      </section>}
    </>}
    <footer className="portal-footer">Orientaciones generales: ante sospecha de gusano barrenador solicita atención veterinaria y notifica inmediatamente al SENASICA. Una fotografía de tejido aparentemente sano no cierra seguimientos existentes.</footer>
  </main>
}
