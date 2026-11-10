import { CalendarDays, Clock3, Info } from 'lucide-react'
import { MONTHS, periodLabel } from '../data/history.js'

export default function TimeNavigator({mode,onModeChange,month,onMonthChange,from,onFromChange,to,onToChange}) {
  const selection={mode,month,from,to}
  const chooseFrom=value=>{onFromChange(value);if(value>to) onToChange(value)}
  const chooseTo=value=>{onToChange(value);if(value<from) onFromChange(value)}
  return <section className="time-navigator" aria-label="Filtros de periodo">
    <div className="time-nav-head">
      <div className="time-nav-title"><span className="time-nav-symbol"><CalendarDays size={17}/></span><div><strong>Explorar por periodo</strong><span>Consulta el territorio y sus evaluaciones simuladas</span></div></div>
      <span className="time-demo-tag"><Clock3 size={13}/> Histórico de ejemplo</span>
    </div>
    <div className="time-nav-controls">
      <div className="time-segments" role="group" aria-label="Tipo de periodo">
        <button type="button" className={mode==='current'?'active':''} aria-pressed={mode==='current'} onClick={()=>onModeChange('current')}>Vista actual</button>
        <button type="button" className={mode==='month'?'active':''} aria-pressed={mode==='month'} onClick={()=>onModeChange('month')}>Por mes</button>
        <button type="button" className={mode==='range'?'active':''} aria-pressed={mode==='range'} onClick={()=>onModeChange('range')}>Rango de meses</button>
      </div>
      {mode==='month'&&<label className="time-select-label"><span>Mes a consultar</span><select value={month} onChange={e=>onMonthChange(e.target.value)}>{MONTHS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label>}
      {mode==='range'&&<div className="time-range-selectors"><label className="time-select-label"><span>Desde</span><select value={from} onChange={e=>chooseFrom(e.target.value)}>{MONTHS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label><span className="time-range-separator">—</span><label className="time-select-label"><span>Hasta</span><select value={to} onChange={e=>chooseTo(e.target.value)}>{MONTHS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label></div>}
    </div>
    <div className="time-nav-summary"><span className="time-summary-icon"><Info size={13}/></span><span><strong>{periodLabel(selection)}</strong> · {mode==='range'?'Un bovino se cuenta una sola vez, según su mayor riesgo observado durante el intervalo.':mode==='month'?'Última evaluación ficticia de cada bovino para el mes seleccionado.':'Última evaluación ficticia disponible de cada bovino.'}</span></div>
  </section>
}
